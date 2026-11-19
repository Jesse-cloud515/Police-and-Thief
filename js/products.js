// =============================================================
// PRODUCTS: everything sold for real money.            [PAY]
// The game and the server both read this list, so a price can only be
// changed here. The server refuses a payment whose amount doesn't match.
//
// price is in naira (NGN). Paystack charges in kobo, so the code
// multiplies by 100 when it starts a payment.
// "cash" is the in-game ₦ the player receives.
// =============================================================
export const PRODUCTS = [
  { id: 'cash_s',  kind: 'cash',  name: 'Small bag of ₦',    price: 300,  cash: 1000, icon: '💵' },
  { id: 'cash_m',  kind: 'cash',  name: 'Big bag of ₦',      price: 900,  cash: 3500, icon: '💰', tag: 'MOST POPULAR' },
  { id: 'cash_l',  kind: 'cash',  name: 'Ghana-Must-Go of ₦', price: 1800, cash: 8000, icon: '🧳', tag: 'BEST VALUE' },
  { id: 'owambe',  kind: 'pack',  name: 'Owambe Pack',       price: 1200, icon: '🎉',
    items: ['t_agbada', 'gele_gold', 'p_ceremonial'], blurb: 'Agbada and gold gele for your thief, ceremonial green for your police. Only sold here.' },
  { id: 'areaboss', kind: 'pack', name: 'Area Boss Pack',    price: 1500, icon: '😎', cash: 1000,
    items: ['t_boss', 'p_rrs'], blurb: 'Area Boss stripes and Rapid Response black, plus ₦1,000. Only sold here.' },
  { id: 'noads',   kind: 'noads', name: 'No ad breaks',      price: 1000, icon: '🚫',
    blurb: 'No more ad breaks between games, forever on this device. Ads you choose to watch for free ₦ still work.' },
];
export const productById = id => PRODUCTS.find(p => p.id === id) || null;
