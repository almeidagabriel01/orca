import type { NativeChatNoticeLook } from '../../../../../../shared/native-chat/transcript/notices/native-chat-notice'
import { NativeChatAgentSwitchRow } from './NativeChatAgentSwitchRow'
import { NativeChatForkedFromRow } from './NativeChatForkedFromRow'

/** The rule where a chat's history came from elsewhere: a fork's source, or another agent or account. */
export function NativeChatLineageRule({
  look
}: {
  look: Extract<NativeChatNoticeLook, { kind: 'forked-from' | 'agent-switch' }>
}): React.JSX.Element {
  return look.kind === 'forked-from' ? (
    <NativeChatForkedFromRow look={look} />
  ) : (
    <NativeChatAgentSwitchRow mark={look.mark} />
  )
}
