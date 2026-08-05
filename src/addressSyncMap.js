const addressFieldPairs = [
  ['037', '048'], // Address Line 1
  ['038', '049'], // Address Line 2
  ['039', '050'], // Address Line 3
  ['040', '051'], // Village
  ['041', '052'], // City
  ['042', '053'], // District
  ['043', '054'], // State
  ['044', '055'], // Country
  ['045', '056'], // PIN Code
];

export const addressSyncSections = [3, 7].map((page) => ({
  yesId: `p${page}_046`,
  noId: `p${page}_047`,
  pairs: addressFieldPairs.map(([permanent, current]) => ({
    permanentId: `p${page}_${permanent}`,
    currentId: `p${page}_${current}`,
  })),
}));
