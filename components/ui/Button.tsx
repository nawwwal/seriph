'use client';

import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentPropsWithoutRef, ReactNode, Ref } from 'react';
import { buttonClassName, type ButtonIconPosition, type ButtonSize, type ButtonTone } from './buttonStyles';

type BaseButtonProps = ComponentPropsWithoutRef<typeof BaseButton>;

export interface ButtonProps extends Omit<BaseButtonProps, 'children' | 'className'> {
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  iconPosition?: ButtonIconPosition;
  ref?: Ref<HTMLElement>;
  size?: ButtonSize;
  tone?: ButtonTone;
}

export function Button({
  children,
  className,
  icon,
  iconPosition = 'start',
  ref,
  size = 'md',
  tone = 'default',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      ref={ref}
      className={buttonClassName({ className, iconPosition: icon ? iconPosition : 'none', size, tone })}
      {...props}
    >
      {icon && iconPosition === 'start' && icon}
      {children}
      {icon && iconPosition === 'end' && icon}
    </BaseButton>
  );
}
