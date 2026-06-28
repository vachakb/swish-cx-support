// Money is integer paise everywhere. These helpers are for display only.

export const formatINR = (paise: number): string =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const rupees = (paise: number): number => paise / 100;
