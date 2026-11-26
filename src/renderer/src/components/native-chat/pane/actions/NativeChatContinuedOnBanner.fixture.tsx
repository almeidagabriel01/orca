import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { NativeChatContinuedOnBanner } from './NativeChatContinuedOnBanner'

// No paired host in a fixture: the destination reads as unknown here, by its saved name.
function Surface({ hostLabel }: { hostLabel: string }): React.JSX.Element {
  return (
    <div className="native-chat-appearance bg-background p-4 text-chat-foreground">
      <NativeChatContinuedOnBanner continuedTo={{ hostLabel, worktreeId: 'develop', at: 0 }} />
    </div>
  )
}

export const continuedOnVps = defineFixture({
  width: 640,
  render: () => <Surface hostLabel="vps" />
})

export const continuedOnMac = defineFixture({
  width: 640,
  render: () => <Surface hostLabel="Local Mac" />
})
