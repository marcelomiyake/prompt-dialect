import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelEffort, On, PluginOptions, PromptBox, RenderSurface, Timer } from 'claude-code'
import {
  CheckGrammar,
  ImprovePrompt,
  LruCache,
  TargetModel,
  defaultPromptingGuides,
  type GrammarReview,
  type ImprovePromptOutcome,
  type LanguageModel,
} from '../../core'
import { drawBand, type BandActions } from './band'
import { decorationsFor } from './decorations'
import { foldedPastes, judgeTypedText } from './pastes'
import type { DialectState, ImprovementState } from './plugin-state'
import { bandView } from './presenter'
import { reviewFromState, reviewToState } from './review-state'
import { settingsFrom, type Settings } from './settings'

const TOOL = 'Claude Code'
const ENABLED_STORE_KEY = 'isEnabled'
const MODEL_TIMEOUT_MS = 30_000
/** Past these, filling the box again could fold the draft into a paste placeholder. */
const MAX_REPAINT_LENGTH = 800
const MAX_REPAINT_LINES = 3

const INITIAL_STATE: DialectState = {
  draft: '',
  review: null,
  improvement: null,
  dismissed: null,
  failure: null,
  isEnabled: true,
}
const session = atom({ plugin: 'prompt-dialect', key: 'session' } as const, INITIAL_STATE)

const reviews = new LruCache<string, GrammarReview>(64)
const guides = defaultPromptingGuides()
let pendingCheck: Timer | undefined
let runningCheck: AbortController | undefined
let runningImprovement: AbortController | undefined
/**
 * How many changes to the box the hooks have seen, counted as each one
 * reaches them. A fill replaces the whole box, so it goes ahead only while
 * this stands where it stood when the text to fill was worked out.
 */
let boxChanges = 0

export function register(on: On, options: PluginOptions): void {
  const settings = settingsFrom(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dialect',
      description: 'Turn prompt-dialect grammar checking on or off, or show its status',
      argumentHint: '[on|off]',
    })
    const stored = await $.store.get(ENABLED_STORE_KEY)
    const isEnabled = typeof stored === 'boolean' ? stored : settings.checkAsYouType
    await update($, session, state => ({ ...state, isEnabled }))
    return next(e)
  })

  on('command.run', { command: 'dialect' }, async ($, e) => {
    const argument = e.args.trim().toLowerCase()
    if (argument === 'on' || argument === 'off') {
      const isEnabled = argument === 'on'
      await update($, session, state => ({ ...state, isEnabled }))
      await $.store.set(ENABLED_STORE_KEY, isEnabled)
      stopChecking()
      return { text: isEnabled ? 'Checking prompts as you type.' : 'Prompt checking is off.' }
    }
    if (argument !== '') {
      return { text: 'Usage: /dialect [on|off]' }
    }
    const { isEnabled } = await read($, session)
    return {
      text: [
        `Prompt checking is ${isEnabled ? 'on' : 'off'}.`,
        `Grammar model: ${settings.grammarModel}; rewrite model: ${settings.improvementModel}.`,
        `Checks run ${settings.debounceMs} ms after you stop typing.`,
      ].join('\n'),
    }
  })

  on('prompt.edit', async ($, e, next) => {
    boxChanges += 1
    const box = await next(e)
    const review = await followDraft($, box.text, settings)
    if (!review?.hasSuggestions) {
      return box
    }
    return { ...box, decorations: [...(box.decorations ?? []), ...decorationsFor(review)] }
  })

  on('prompt.change', async ($, e, next) => {
    if (e.origin.kind === 'plugin' && e.origin.name === $.plugin.name) {
      return next(e)
    }
    boxChanges += 1
    const result = await next(e)
    await followDraft($, e.text, settings)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    const state = await read($, session)
    const view = bandView({
      draft: state.draft,
      review: state.review === null ? undefined : reviewFromState(state.review),
      isReviewFresh: state.review?.isFresh === true,
      improvement: state.improvement,
      failure: state.failure?.draft === state.draft ? state.failure.message : undefined,
      isDismissed: state.dismissed === state.draft,
      isEnabled: state.isEnabled,
      targetLabel: TargetModel.parse(await $.session.model()).label,
      columns: e.props.bodyColumns,
      maxRows: e.props.maxRows,
      isPointerAvailable: e.viewport?.isFullscreen === true,
    })
    if (!view.isVisible) {
      return next(e)
    }
    const actions: BandActions = {
      accept: id => void acceptSuggestion($, id, settings),
      acceptAll: () => void acceptAllSuggestions($, settings),
      improve: () => void improveDraft($, settings),
      useImprovement: () => void useImprovement($, settings),
      copyImprovement: surface => void copyImprovement($, surface as RenderSurface),
      dismiss: () => void dismissBand($),
    }
    return drawBand($.ui.resolve(e), view, actions)
  })
}

/**
 * Keeps the mod's picture of the draft in step with the box: carries the
 * review over the edit and asks for a check once the writer pauses. Answers
 * the review for the draft as it now stands, or undefined while checking is off.
 */
async function followDraft($: EngineInterface, text: string, settings: Settings): Promise<GrammarReview | undefined> {
  const state = await read($, session)
  if (!state.isEnabled) {
    return undefined
  }
  const review = state.review === null ? undefined : reviewFromState(state.review)
  if (state.draft === text) {
    return review?.isFor(text) ? review : undefined
  }
  const carried = review?.rebase(text)
  await update($, session, current => ({
    ...current,
    draft: text,
    review: carried === undefined ? current.review : reviewToState(carried, false),
  }))
  scheduleCheck($, settings)
  return carried
}

function scheduleCheck($: EngineInterface, settings: Settings): void {
  stopChecking()
  pendingCheck = $.clock.after(settings.debounceMs, () => {
    pendingCheck = undefined
    void checkDraft($, settings)
  })
}

function stopChecking(): void {
  pendingCheck?.cancel()
  pendingCheck = undefined
  runningCheck?.abort()
  runningCheck = undefined
}

async function checkDraft($: EngineInterface, settings: Settings): Promise<void> {
  const changes = boxChanges
  const box = await $.prompt.read()
  if (judgeTypedText(box.text) !== 'reviewable') {
    return
  }
  const controller = new AbortController()
  runningCheck = controller
  const checker = new CheckGrammar(claudeCodeModel($, settings.grammarModel, 'low'), { cache: reviews })
  const outcome = await checker.execute(box.text, controller.signal)
  if (runningCheck === controller) {
    runningCheck = undefined
  }
  if (controller.signal.aborted || outcome.status === 'skipped') {
    return
  }
  if (outcome.status === 'failed') {
    await update($, session, state => ({ ...state, failure: { draft: box.text, message: outcome.reason } }))
    return
  }
  const { review } = outcome
  const now = await $.prompt.read()
  if (now.text !== box.text) {
    return
  }
  await update($, session, state => ({ ...state, draft: box.text, failure: null, review: reviewToState(review, true) }))
  if (review.hasSuggestions) {
    await repaint($, review, changes)
  }
}

/**
 * Underlines `review` now instead of at the next edit, by filling the box
 * again with its own text. Only while it holds the reviewed text, no change
 * has reached the hooks since `changes`, and nothing would move: the fill
 * replaces the whole box, so it must never put an older text over newer typing.
 */
async function repaint($: EngineInterface, review: GrammarReview, changes: number): Promise<void> {
  const box = await $.prompt.read()
  if (boxChanges === changes && box.text === review.text && canRepaint(box)) {
    await $.prompt.fill({ text: box.text, mode: 'replace', decorations: decorationsFor(review) })
  }
}

/** The box paints decorations on the next edit; fill it again now when that moves nothing. */
function canRepaint(box: PromptBox): boolean {
  return (
    box.cursor === box.text.length &&
    box.text.length <= MAX_REPAINT_LENGTH &&
    box.text.split('\n').length <= MAX_REPAINT_LINES
  )
}

async function acceptSuggestion($: EngineInterface, id: string, settings: Settings): Promise<void> {
  const changes = boxChanges
  const review = await reviewOfBox($)
  if (review?.find(id) !== undefined) {
    const accepted = review.accept(id)
    await fillDraft($, settings, changes, { text: accepted.text, review: accepted })
  }
}

async function acceptAllSuggestions($: EngineInterface, settings: Settings): Promise<void> {
  const changes = boxChanges
  const review = await reviewOfBox($)
  if (review?.hasSuggestions) {
    const accepted = review.acceptAll()
    await fillDraft($, settings, changes, { text: accepted.text, review: accepted })
  }
}

/** The review, when it is for the text in the box right now. */
async function reviewOfBox($: EngineInterface): Promise<GrammarReview | undefined> {
  const { review } = await read($, session)
  const box = await $.prompt.read()
  return review?.text === box.text ? reviewFromState(review) : undefined
}

/** A draft to put in the box, and what the mod knows of it. */
type DraftFill = {
  readonly text: string
  /** The suggestions for `text`, underlined as it lands; none known when absent. */
  readonly review?: GrammarReview
  /** Clears the rewrite on offer once `text` is in the box; kept when absent. */
  readonly improvement?: null
}

/**
 * Puts `fill.text` in the box over the draft, unless a change has reached
 * the hooks since `changes`, then keeps the state to what the box took:
 * nothing when it refused the text, `fill` when it took it as given, and the
 * review carried over, with a check to come, when a hook put other text there.
 */
async function fillDraft($: EngineInterface, settings: Settings, changes: number, fill: DraftFill): Promise<void> {
  if (boxChanges !== changes) {
    return
  }
  const decorations = fill.review === undefined ? [] : decorationsFor(fill.review)
  const filled = await $.prompt.fill({ text: fill.text, mode: 'replace', decorations })
  if (!filled.isFilled) {
    return
  }
  const isAsGiven = filled.text === fill.text
  const carried = fill.review?.rebase(filled.text)
  const landed: Partial<DialectState> = {
    draft: filled.text,
    review: carried === undefined ? null : reviewToState(carried, isAsGiven),
    ...(fill.improvement === undefined ? {} : { improvement: fill.improvement }),
  }
  await update($, session, state => (boxChanges === changes ? { ...state, ...landed } : state))
  if (!isAsGiven) {
    scheduleCheck($, settings)
  }
}

async function dismissBand($: EngineInterface): Promise<void> {
  const box = await $.prompt.read()
  await update($, session, state => ({ ...state, dismissed: box.text }))
}

/**
 * Rewrites the draft in the box; a newer request supersedes it, and its result
 * is dropped. Never while a paste is folded, since the rewrite would leave it out.
 */
async function improveDraft($: EngineInterface, settings: Settings): Promise<void> {
  runningImprovement?.abort()
  const controller = new AbortController()
  runningImprovement = controller
  const box = await $.prompt.read()
  if (foldedPastes(box.text).length > 0) {
    return
  }
  const target = TargetModel.parse(await $.session.model())
  const working: ImprovementState = { status: 'working', draft: box.text, target: target.label }
  await update($, session, state => (runningImprovement === controller ? { ...state, improvement: working } : state))
  const rewriter = new ImprovePrompt(claudeCodeModel($, settings.improvementModel, 'medium'), guides)
  const outcome = await rewriter.execute({ draft: box.text, target, tool: TOOL, signal: controller.signal })
  if (runningImprovement !== controller) {
    return
  }
  runningImprovement = undefined
  const improvement = improvementStateOf(outcome, box.text, target.label)
  await update($, session, state => ({ ...state, improvement }))
}

function improvementStateOf(outcome: ImprovePromptOutcome, draft: string, target: string): ImprovementState {
  switch (outcome.status) {
    case 'improved':
      return {
        status: 'ready',
        draft,
        target,
        improved: outcome.improvement.improved,
        notes: [...outcome.improvement.notes],
      }
    case 'unchanged':
      return { status: 'unchanged', draft, target }
    case 'skipped':
      return { status: 'failed', draft, target, message: 'the draft is too short to rewrite' }
    default:
      return { status: 'failed', draft, target, message: outcome.reason }
  }
}

/** Puts the rewrite in the box, while the box still holds the draft it was written from. */
async function useImprovement($: EngineInterface, settings: Settings): Promise<void> {
  const changes = boxChanges
  const { improvement } = await read($, session)
  const box = await $.prompt.read()
  if (improvement?.status === 'ready' && improvement.draft === box.text) {
    await fillDraft($, settings, changes, { text: improvement.improved, improvement: null })
  }
}

async function copyImprovement($: EngineInterface, surface: RenderSurface): Promise<void> {
  const { improvement } = await read($, session)
  if (improvement?.status !== 'ready') {
    return
  }
  const copied = await $.ui.copy({ text: improvement.improved, surface })
  $.ui.toast(copied.isCopied ? 'Suggested prompt copied.' : 'Could not copy the suggested prompt.')
}

/** The core's language-model port, answered by the session's own API client. */
function claudeCodeModel($: EngineInterface, model: string, effort: ModelEffort): LanguageModel {
  return {
    complete: async request => {
      const result = await $.model.complete(
        {
          model,
          system: request.system,
          prompt: request.prompt,
          maxTokens: request.maxTokens,
          effort,
          timeoutMs: MODEL_TIMEOUT_MS,
        },
        { signal: request.signal },
      )
      if (result.isAnswered) {
        return { isAnswered: true, text: result.text }
      }
      return {
        isAnswered: false,
        reason: result.reason === 'api-error' ? `${result.error} (${result.status ?? 'no response'})` : result.reason,
      }
    },
  }
}
