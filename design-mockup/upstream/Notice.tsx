import { NoticeBase, type NoticeBaseProps } from './NoticeBase';

export type NoticeProps = Omit<NoticeBaseProps, 'tone'> & { tone?: 'info' | 'warning' | 'error' };

/** Source-workspace inline notice. The caller owns content, actions and recovery. */
export function Notice({ tone = 'info', className = '', ...props }: NoticeProps) {
  return <NoticeBase {...props} tone={tone} data-notice-tone={tone} className={`kb-system-notice ${className}`} />;
}
