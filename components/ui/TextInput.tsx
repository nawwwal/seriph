'use client';

import { Input as BaseInput } from '@base-ui/react/input';
import type { ComponentPropsWithoutRef, Ref } from 'react';
import { textInputClassName, type TextInputSize } from './textInputStyles';

type BaseInputProps = ComponentPropsWithoutRef<typeof BaseInput>;

export interface TextInputProps extends Omit<BaseInputProps, 'className' | 'size'> {
  className?: string;
  ref?: Ref<HTMLElement>;
  size?: TextInputSize;
}

export function TextInput({ className, ref, size = 'form', ...props }: TextInputProps) {
  return <BaseInput ref={ref} className={textInputClassName({ className, size })} {...props} />;
}
