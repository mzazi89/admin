// MZAZI TECH — design-system barrel.
//
// Import from '@/components/ui' everywhere. Keeping one entry point is what
// keeps the user site and the admin panel visually identical: both consume the
// same tokens (app/globals.css) and the same primitives (here).

export { default as AppBackground } from './AppBackground';
export { default as Badge, StatusIndicator, planLabel, planTone } from './Badge';
export { default as Button } from './Button';
export { default as Card, CardHeader, StatCard } from './Card';
export { default as DeviceCard, formatPhone } from './DeviceCard';
export { default as ImageWithFallback, Avatar } from './ImageWithFallback';
export { default as RouteBackdrop } from './RouteBackdrop';
export { default as Modal, ConfirmDialog } from './Modal';
export { default as PlanCard, BotMark } from './PlanCard';
export { default as ThemeToggle } from './ThemeToggle';
export { ThemeProvider, useTheme, THEME_BOOT_SCRIPT, THEME_KEY } from './ThemeProvider';
export { ToastProvider, useToast } from './Toast';
export {
  Loader, LoadingState, Skeleton, SkeletonText, SkeletonCards,
  EmptyState, ErrorState, Alert, humaniseError,
} from './Feedback';
export {
  PageHeader, Field, Input, Textarea, Select, SearchInput,
  Toggle, WizardSteps, ProgressBar, RowMenu, DataTable,
} from './Layout';
export * as Icons from './Icons';
