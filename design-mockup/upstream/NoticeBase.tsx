import type { ComponentPropsWithRef } from 'react';

export type NoticeTone = 'info' | 'warning' | 'error' | 'success';
export type NoticeBaseProps = ComponentPropsWithRef<'div'> & { tone?: NoticeTone };

/** Announcement semantics only; each visual family owns its presentation and lifecycle. */
export function NoticeBase({ tone = 'info', role = tone === 'error' ? 'alert' : 'status', ...props }: NoticeBaseProps) {
  return <div {...props} role={role} />;
}
