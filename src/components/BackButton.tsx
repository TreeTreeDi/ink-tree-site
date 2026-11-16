import { AnimatePresence, motion } from 'motion/react';

interface BackButtonProps {
  visible: boolean;
  onBack: () => void;
}

export function BackButton({ visible, onBack }: BackButtonProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          className="back-pill"
          onClick={onBack}
          aria-label="Back to tree overview"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.22 }}
        >
          <svg width="16" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <path
              d="M6.5 2.5 L2.2 6.8 L6.5 11.1 M2.6 6.8 H12.4 C14.7 6.8 16 8.1 16 10.2 C16 11.4 15.3 12 14.2 12"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
