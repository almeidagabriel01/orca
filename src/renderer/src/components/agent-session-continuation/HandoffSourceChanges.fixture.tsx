import { defineFixture } from '../../component-fixtures/component-fixture'
import { HandoffSourceChanges, type HandoffSourceChangesState } from './HandoffSourceChanges'

const dirty: HandoffSourceChangesState = {
  kind: 'dirty',
  uncommitted: 3,
  unpushed: 2,
  branch: 'develop',
  hasUpstream: true
}

const frame =
  (state: HandoffSourceChangesState, extra: { running?: boolean; error?: string | null } = {}) =>
  () => (
    <div className="bg-background p-4">
      <HandoffSourceChanges
        state={state}
        message="chore: save work before hand-off"
        onMessageChange={() => {}}
        onCommitAndPush={() => {}}
        running={extra.running ?? false}
        error={extra.error ?? null}
        hostLabel="vps"
      />
    </div>
  )

export const dirtySource = defineFixture({ width: 520, render: frame(dirty) })

export const pushOnly = defineFixture({
  width: 520,
  render: frame({ ...dirty, uncommitted: 0 })
})

export const running = defineFixture({
  width: 520,
  render: frame(dirty, { running: true })
})

export const failed = defineFixture({
  width: 520,
  render: frame(dirty, {
    error: 'Push rejected: the remote has commits you do not have.'
  })
})

export const checking = defineFixture({
  width: 520,
  render: frame({ kind: 'checking' })
})

export const clean = defineFixture({
  width: 520,
  render: frame({ kind: 'clean', branch: 'develop' })
})
