import type { ReactNode } from 'react';
import styles from './styles.module.css';

export interface ButtonProps {
  children?: ReactNode;
}

export const Button = ({ children }: ButtonProps) => {
  return (
    <button type='button' className={styles.button}>
      {children}
    </button>
  );
};
