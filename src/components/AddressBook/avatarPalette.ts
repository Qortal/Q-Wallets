export const addressBookAvatarColors = [
  '#AEB7FF',
  '#8CCAFF',
  '#FFB4C1',
  '#7DE3C2',
  '#FFD98A',
  '#C3B1FF',
  '#6ED7E6',
  '#FFC38A',
  '#B6E3A3',
  '#E2B7FF',
];

export const getAddressBookAvatarColor = (seed: string, fallbackIndex = 0) => {
  const source = seed.trim() || String(fallbackIndex);
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return addressBookAvatarColors[hash % addressBookAvatarColors.length];
};

export const getAddressBookAvatarSx = (color: string) => ({
  bgcolor: color,
  boxShadow: `0 0 18px color-mix(in srgb, ${color} 38%, transparent)`,
  color: 'rgba(5, 22, 32, 0.86)',
  textShadow: '0 1px 0 rgba(255,255,255,0.22)',
});
