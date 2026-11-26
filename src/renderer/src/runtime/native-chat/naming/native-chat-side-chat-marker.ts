import { translate } from '@/i18n/i18n'

type SideChatFacts = { forkedFrom?: { sideChat?: true } | null } | null | undefined

/** The one reader of the side-chat mark; swap the source here when the mark moves. */
export function isNativeChatSideChat(note: SideChatFacts): boolean {
  return note?.forkedFrom?.sideChat === true
}

/** A side chat's title: its saved name (the parent's) under "Side chat ·"; bare while unnamed. */
export function nativeChatSideChatTitle(parentName: string | null): string {
  return parentName
    ? translate('components.native-chat.sideChat.title', 'Side chat · {{name}}', {
        name: parentName
      })
    : translate('components.native-chat.sideChat.titleUnnamed', 'Side chat')
}
