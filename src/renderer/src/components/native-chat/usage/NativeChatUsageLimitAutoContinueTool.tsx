import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import {
  openUsageLimitContinueSetting,
  turnOnUsageLimitAutoContinue,
  type NativeChatUsageLimitAutoContinueState
} from './native-chat-usage-limit-auto-continue-setting'
import { UsageLimitToolButton } from './NativeChatUsageLimitRowControls'

type AutoContinueControl = {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
}

type AutoContinueProps = {
  auto: NativeChatUsageLimitAutoContinueState
  autoTime: string | null
}

function autoContinueControl(
  { auto, autoTime }: AutoContinueProps,
  settingOn: boolean,
  labeled: boolean,
  t: Translate
): AutoContinueControl {
  if (auto.kind === 'scheduled') {
    return {
      label: labeled
        ? t('components.native-chat.usageLimitActions.continueAtToggle', 'Continue at {{time}}', {
            time: autoTime
          })
        : t('components.native-chat.usageLimitActions.cancelAt', "Don't continue at {{time}}", {
            time: autoTime
          }),
      pressed: true,
      disabled: auto.cancelDisabled,
      onClick: auto.cancel
    }
  }
  const offLabel = t(
    'components.native-chat.usageLimitActions.autoContinueOff',
    'Auto-continue off'
  )
  // Off with the setting off: the clock turns it on here, and the host schedules this chat. The
  // host also says off for a chat it can't continue while the setting is on; that opens Settings.
  if (auto.kind === 'off' && !settingOn) {
    return {
      label: labeled
        ? offLabel
        : t(
            'components.native-chat.usageLimitActions.turnOnAutoContinue',
            'Auto-continue on reset'
          ),
      pressed: false,
      onClick: turnOnUsageLimitAutoContinue
    }
  }
  return {
    label: labeled
      ? offLabel
      : auto.kind === 'cancelled'
        ? t('components.native-chat.usageLimitActions.wontContinue', "Won't continue automatically")
        : t(
            'components.native-chat.usageLimitActions.autoContinueSettings',
            'Auto-continue settings'
          ),
    onClick: openUsageLimitContinueSetting
  }
}

function useAutoContinueSettingOn(): boolean {
  return useAppStore((state) => state.settings?.nativeChatAutoContinueAfterUsageLimit === true)
}

/** The row's clock icon: Orca's continue at the reset, its cancel, or its setting. */
export function AutoContinueTool(props: AutoContinueProps): React.JSX.Element {
  const t = useTranslate()
  const control = autoContinueControl(props, useAutoContinueSettingOn(), false, t)
  return (
    <UsageLimitToolButton
      label={control.label}
      pressed={control.pressed}
      disabled={control.disabled}
      onClick={control.onClick}
    >
      <Clock className="size-3.5" />
    </UsageLimitToolButton>
  )
}

/** The clock as a labeled toggle: pressed names when Orca continues; off says so. */
export function AutoContinueLabeledTool(props: AutoContinueProps): React.JSX.Element {
  const t = useTranslate()
  const control = autoContinueControl(props, useAutoContinueSettingOn(), true, t)
  return (
    <Button
      type="button"
      variant="chat-tool"
      size="xs"
      aria-pressed={control.pressed}
      // Why aria-disabled: a natively disabled button drops focus.
      aria-disabled={control.disabled || undefined}
      onClick={control.disabled ? undefined : control.onClick}
    >
      <Clock />
      <span className="tabular-nums">{control.label}</span>
    </Button>
  )
}
