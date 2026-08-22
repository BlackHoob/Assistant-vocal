import { ButtonHTMLAttributes } from 'react';

interface AccessibleIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string; 
}

export default function AccessibleIconButton({ icon, label, className, ...rest }: AccessibleIconButtonProps) {
  return (
    <button aria-label={label} title={label} className={className} {...rest}>
      {icon}
    </button>
  );
}

