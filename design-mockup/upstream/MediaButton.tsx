import { ButtonBase, type ButtonBaseProps } from './ButtonBase';

export type MediaButtonProps = ButtonBaseProps & {
  media: 'image' | 'audio' | 'video';
  emphasis?: 'primary' | 'secondary' | 'quiet';
  iconOnly?: boolean;
};

/** C: media owns the accent; the caller chooses priority for this task. */
export function MediaButton({ media, emphasis = 'secondary', iconOnly = false,
  busy = false, className = '', ...props }: MediaButtonProps) {
  return <ButtonBase {...props} busy={busy} data-media={media} data-emphasis={emphasis}
    className={`kb-media-button ${iconOnly ? 'kb-media-button-icon' : ''} ${className}`} />;
}
