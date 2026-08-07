import { CLASSIC_MEDINA_LINE_COUNT } from './qcfV2Page';

export type ClassicMedinaMetrics = {
  pageHeight: number;
  lineHeight: number;
  fontSize: number;
};

export function classicMedinaMetrics(width: number, availableHeight: number): ClassicMedinaMetrics {
  const pageHeight = Math.max(180, Math.floor(availableHeight));
  const lineHeight = pageHeight / CLASSIC_MEDINA_LINE_COUNT;
  return {
    pageHeight,
    lineHeight,
    fontSize: Math.max(10, Math.min(lineHeight * 0.56, width / 13)),
  };
}
