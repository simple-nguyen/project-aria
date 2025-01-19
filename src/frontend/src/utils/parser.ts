export const formatCrypto = (
  value: string | number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }
) => {
  if (typeof value === 'string') {
    return parseFloat(value).toLocaleString(undefined, {
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
  });
};
export const formatFiat = (
  value: string | number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }
) => {
  if (typeof value === 'string') {
    return parseFloat(value).toLocaleString(undefined, {
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
  });
};
