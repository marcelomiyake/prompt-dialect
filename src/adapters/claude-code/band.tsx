import type { BoxProps, ButtonProps, ElementConstructor, RenderElement, TextProps } from 'claude-code'
import type { BandView, ChipView, ImprovementView, Segment } from './presenter'

/** The elements the band draws with, as `$.ui.resolve(e)` hands them out. */
export type BandElements = {
  readonly Box: ElementConstructor<BoxProps>
  readonly Text: ElementConstructor<TextProps>
  readonly Button: ElementConstructor<ButtonProps>
}

/** What the band's controls do; the hooks module binds each to the engine. */
export type BandActions = {
  readonly accept: (id: string) => void
  readonly acceptAll: () => void
  readonly improve: () => void
  readonly useImprovement: () => void
  readonly copyImprovement: (surface: string) => void
  readonly dismiss: () => void
}

const TONE_STYLE: Readonly<Record<Segment['tone'], TextProps>> = {
  context: {},
  removed: { color: 'error', strikethrough: true },
  added: { color: 'suggestion', weight: 'bold' },
}

/**
 * The band above the prompt: the words to fix as chips (hover one for its fix
 * in context, press it to apply), the pastes it could not read, the
 * model-aware rewrite, and its result.
 */
export function drawBand(ui: BandElements, view: BandView, actions: BandActions): RenderElement {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text color="suggestion">✎</Text>
        {view.status !== '' && <Text dimColor>{view.status}</Text>}
        {view.chips.map(chip => drawChip(ui, chip, actions))}
        {view.chips.length > 1 && <Button key="fix-all" label="Fix all" hotkey="a" onPress={actions.acceptAll} />}
        {drawImproveControl(ui, view.improvement, actions)}
        <Button key="dismiss" label="Hide" plain dimColor onPress={actions.dismiss} />
      </Box>
      {view.chips.length > 0 && (
        <Box flexDirection="row">
          <Text dimColor>{view.hint}</Text>
          {view.chips.map(chip => (
            <Box
              key={`card-${chip.id}`}
              flexDirection="row"
              position="absolute"
              top={0}
              left={0}
              display="none"
              hover={{ display: 'flex', scope: chip.scope }}
            >
              {chip.preview.map(segment => drawSegment(Text, segment))}
            </Box>
          ))}
        </Box>
      )}
      {view.pasteNote !== '' && <Text dimColor>{view.pasteNote}</Text>}
      {drawImprovement(ui, view.improvement, actions)}
    </Box>
  )
}

function drawChip(ui: BandElements, chip: ChipView, actions: BandActions): RenderElement {
  const { Button, Text } = ui
  return (
    <Button
      key={`fix-${chip.id}`}
      plain
      hotkey={chip.hotkey}
      hover={{ scope: chip.scope, bold: true }}
      onPress={() => actions.accept(chip.id)}
    >
      <Text underline color="error">
        {chip.label}
      </Text>
    </Button>
  )
}

function drawSegment(Text: BandElements['Text'], segment: Segment): RenderElement {
  return <Text {...TONE_STYLE[segment.tone]}>{segment.text}</Text>
}

function drawImproveControl(
  ui: BandElements,
  improvement: ImprovementView,
  actions: BandActions,
): RenderElement | null {
  const { Button, Text } = ui
  switch (improvement.kind) {
    case 'offer':
      return <Button key="improve" label={`✨ ${improvement.label}`} hotkey="i" onPress={actions.improve} />
    case 'working':
      return <Text dimColor>✨ {improvement.label}</Text>
    default:
      return null
  }
}

function drawImprovement(ui: BandElements, improvement: ImprovementView, actions: BandActions): RenderElement | null {
  const { Box, Button, Text } = ui
  if (improvement.kind === 'message') {
    return <Text dimColor>✨ {improvement.text}</Text>
  }
  if (improvement.kind !== 'ready') {
    return null
  }
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text color="suggestion">✨ {improvement.title}</Text>
        <Button key="use-improvement" label="Use it" hotkey="u" variant="primary" onPress={actions.useImprovement} />
        <Button
          key="copy-improvement"
          label="Copy"
          hotkey="c"
          onPress={press => actions.copyImprovement(press.surface)}
        />
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        <Text>{improvement.lines.join('\n')}</Text>
        {improvement.hiddenLines > 0 && <Text dimColor>… {improvement.hiddenLines} more lines</Text>}
      </Box>
      {improvement.notes.length > 0 && <Text dimColor>{improvement.notes.map(note => `· ${note}`).join('\n')}</Text>}
    </Box>
  )
}
