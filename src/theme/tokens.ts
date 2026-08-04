import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  control: 12,
  glass: 18,
  panel: 18,
  hero: 18,
  round: 999,
} as const;

export const shadow = {
  floating: Platform.select({
    web: { boxShadow: '0 12px 36px rgba(5, 18, 15, 0.12)' },
    default: {
      shadowColor: '#05120F',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
  }),
  subtle: Platform.select({
    web: { boxShadow: '0 6px 20px rgba(5, 18, 15, 0.07)' },
    default: {
      shadowColor: '#05120F',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  }),
} as const;