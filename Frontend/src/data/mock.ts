// Centralised demonstration data. All prices are demo values, not verified market prices.
// UI never imports this file directly — go through src/services/api.ts.
import type { Address, Category, Order, Product, Recipe, Store, User, MeasurementOption } from "@/types";

import rice from "@/assets/c-rice.jpg";
import beans from "@/assets/c-beans.jpg";
import meat from "@/assets/c-meat.jpg";
import fish from "@/assets/c-fish.jpg";
import veg from "@/assets/c-veg.jpg";
import fruits from "@/assets/c-fruits.jpg";
import yam from "@/assets/c-yam.jpg";
import oil from "@/assets/c-oil.jpg";
import spices from "@/assets/c-spices.jpg";
import frozen from "@/assets/c-frozen.jpg";
import provisions from "@/assets/c-provisions.jpg";
import wholesale from "@/assets/c-wholesale.jpg";
import hero from "@/assets/hero.jpg";
import rJollof from "@/assets/r-jollof.jpg";
import rEgusi from "@/assets/r-egusi.jpg";
import rOgbono from "@/assets/r-ogbono.jpg";
import rFried from "@/assets/r-fried.jpg";
import rPepper from "@/assets/r-pepper.jpg";
import rOha from "@/assets/r-oha.jpg";
import rYam from "@/assets/r-yam.jpg";
import rBeans from "@/assets/r-beans.jpg";

export const heroImage = hero;

export const categories: Category[] = [
  { slug: "rice-grains", name: "Rice & Grains", image: rice, tint: "bg-hot-soft", blurb: "Ofada, parboiled, millet & more" },
  { slug: "beans-garri", name: "Beans & Garri", image: beans, tint: "bg-leaf", blurb: "Oloyin, white garri, ijebu" },
  { slug: "meat-poultry", name: "Meat & Poultry", image: meat, tint: "bg-hot-soft", blurb: "Fresh cuts, cleaned daily" },
  { slug: "fish-seafood", name: "Fish & Seafood", image: fish, tint: "bg-leaf", blurb: "Catfish, prawns, stockfish" },
  { slug: "vegetables", name: "Vegetables", image: veg, tint: "bg-leaf", blurb: "Tomatoes, ugu, peppers" },
  { slug: "fruits", name: "Fruits", image: fruits, tint: "bg-hot-soft", blurb: "Pineapple, mango, pawpaw" },
  { slug: "yam-tubers", name: "Yam & Tubers", image: yam, tint: "bg-cream", blurb: "Abuja yam, cassava, potato" },
  { slug: "cooking-oil", name: "Cooking Oil", image: oil, tint: "bg-hot-soft", blurb: "Palm oil, groundnut oil" },
  { slug: "spices", name: "Spices & Seasonings", image: spices, tint: "bg-cream", blurb: "Crayfish, curry, thyme" },
  { slug: "frozen", name: "Frozen Foods", image: frozen, tint: "bg-leaf", blurb: "Turkey, chicken, fillets" },
  { slug: "provisions", name: "Provisions", image: provisions, tint: "bg-cream", blurb: "Pasta, milk, tomato paste" },
  { slug: "wholesale", name: "Wholesale Foodstuff", image: wholesale, tint: "bg-hot-soft", blurb: "Bags & cartons, bulk prices" },
];

const catImg: Record<string, string> = Object.fromEntries(categories.map((c) => [c.slug, c.image]));

let n = 0;
function p(
  name: string,
  categorySlug: string,
  storeSlug: string,
  options: MeasurementOption[],
  extra: Partial<Pick<Product, "oldPrice" | "stock" | "tags" | "description" | "rating">> = {},
): Product {
  n += 1;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const img = catImg[categorySlug] ?? "";
  return {
    id: `p${n}`,
    name,
    slug,
    categorySlug,
    storeSlug,
    images: [img, ...categories.filter((c) => c.slug !== categorySlug).slice(n % 5, (n % 5) + 2).map((c) => c.image)],
    description:
      extra.description ??
      `Carefully sourced ${name.toLowerCase()} from trusted Nigerian market sellers. Cleaned, sorted and packed fresh on the day of delivery.`,
    options,
    oldPrice: extra.oldPrice,
    stock: extra.stock ?? 40,
    rating: extra.rating ?? 4.6,
    tags: extra.tags ?? [],
  };
}

const o = (unit: MeasurementOption["unit"], label: string, price: number): MeasurementOption => ({ unit, label, price });

export const products: Product[] = [
  // Rice & grains
  p("Local Rice", "rice-grains", "chika-rice-depot", [o("kg", "1 kg", 3200), o("derica", "1 derica", 1100), o("paint", "1 paint", 9500), o("bag", "50kg bag", 145000)], { oldPrice: 3600, tags: ["deal", "popular"] }),
  p("Ofada Rice", "rice-grains", "chika-rice-depot", [o("kg", "1 kg", 3800), o("cup", "1 cup", 600), o("paint", "1 paint", 11000)], { tags: ["popular", "recommended"] }),
  p("Parboiled Long Grain Rice", "rice-grains", "chika-rice-depot", [o("kg", "1 kg", 2900), o("bag", "25kg bag", 68000), o("bag", "50kg bag", 132000)], { tags: ["essential"] }),
  p("Millet Grains", "rice-grains", "mama-ngozi", [o("kg", "1 kg", 1800), o("cup", "1 cup", 350)], { stock: 6 }),
  // Beans & garri
  p("Brown Beans (Oloyin)", "beans-garri", "mama-ngozi", [o("kg", "1 kg", 2800), o("derica", "1 derica", 950), o("paint", "1 paint", 8500)], { oldPrice: 3100, tags: ["deal", "popular"] }),
  p("White Garri", "beans-garri", "mama-ngozi", [o("kg", "1 kg", 1500), o("cup", "1 cup", 300), o("paint", "1 paint", 4800)], { tags: ["popular", "essential"] }),
  p("Ijebu Garri", "beans-garri", "mama-ngozi", [o("kg", "1 kg", 1700), o("paint", "1 paint", 5200)], { tags: ["recommended"] }),
  p("Black-eyed Beans", "beans-garri", "chika-rice-depot", [o("kg", "1 kg", 2600), o("derica", "1 derica", 900)], { stock: 0 }),
  // Meat
  p("Fresh Chicken", "meat-poultry", "fresh-farm-meat", [o("kg", "1 kg", 7500), o("piece", "Whole bird", 14500)], { oldPrice: 8200, tags: ["deal", "popular"] }),
  p("Beef (Boneless)", "meat-poultry", "fresh-farm-meat", [o("kg", "1 kg", 6800), o("g", "500 g", 3500)], { tags: ["popular"] }),
  p("Goat Meat", "meat-poultry", "fresh-farm-meat", [o("kg", "1 kg", 8500), o("g", "500 g", 4400)], { tags: ["recommended"] }),
  p("Cow Leg & Kpomo Mix", "meat-poultry", "fresh-farm-meat", [o("kg", "1 kg", 5200)], { stock: 8 }),
  // Fish
  p("Frozen Fish (Titus)", "fish-seafood", "lagos-seafood", [o("kg", "1 kg", 5500), o("carton", "Carton (20kg)", 98000)], { tags: ["popular"] }),
  p("Fresh Catfish", "fish-seafood", "lagos-seafood", [o("kg", "1 kg", 4800), o("piece", "1 large fish", 3200)], { oldPrice: 5300, tags: ["deal"] }),
  p("Tiger Prawns", "fish-seafood", "lagos-seafood", [o("kg", "1 kg", 12000), o("g", "500 g", 6200)], { tags: ["recommended"] }),
  p("Stockfish (Okporoko)", "fish-seafood", "lagos-seafood", [o("piece", "Medium head", 4500), o("kg", "1 kg", 18000)], { tags: ["essential"] }),
  // Veg
  p("Fresh Tomatoes", "vegetables", "mama-ngozi", [o("basket", "Small basket", 4500), o("basket", "Big basket", 32000), o("kg", "1 kg", 1600)], { oldPrice: 5200, tags: ["deal", "popular", "essential"] }),
  p("Scotch Bonnet Pepper (Ata Rodo)", "vegetables", "mama-ngozi", [o("cup", "1 cup", 800), o("basket", "Small basket", 6500)], { tags: ["essential"] }),
  p("Ugu Leaves", "vegetables", "mama-ngozi", [o("piece", "1 bunch", 500), o("basket", "Small basket", 3500)], { tags: ["recommended"] }),
  p("Red Onions", "vegetables", "mama-ngozi", [o("kg", "1 kg", 1400), o("bag", "Small bag", 18000)], { tags: ["essential"] }),
  p("Okra", "vegetables", "mama-ngozi", [o("cup", "1 cup", 600), o("kg", "1 kg", 1800)]),
  // Fruits
  p("Sweet Pineapple", "fruits", "mama-ngozi", [o("piece", "1 large", 1500), o("piece", "3 pieces", 4000)], { oldPrice: 1800, tags: ["deal"] }),
  p("Ripe Plantain", "fruits", "mama-ngozi", [o("piece", "1 bunch", 4500), o("piece", "5 fingers", 2000)], { tags: ["popular", "essential"] }),
  p("Mango", "fruits", "mama-ngozi", [o("piece", "6 pieces", 1800), o("basket", "Small basket", 6000)]),
  // Yam
  p("Abuja Yam", "yam-tubers", "mama-ngozi", [o("tuber", "1 medium tuber", 3500), o("tuber", "1 large tuber", 5500)], { tags: ["popular", "essential"] }),
  p("Sweet Potatoes", "yam-tubers", "mama-ngozi", [o("kg", "1 kg", 1200), o("basket", "Small basket", 5500)]),
  p("Cassava Tubers", "yam-tubers", "mama-ngozi", [o("kg", "1 kg", 800)], { stock: 4 }),
  // Oil
  p("Palm Oil", "cooking-oil", "mama-ngozi", [o("litre", "1 litre", 3500), o("litre", "5 litres", 16500), o("litre", "25 litres", 78000)], { tags: ["popular", "essential"] }),
  p("Groundnut Oil", "cooking-oil", "chika-rice-depot", [o("litre", "1 litre", 4200), o("litre", "5 litres", 20000)], { oldPrice: 4600, tags: ["deal", "essential"] }),
  // Spices
  p("Ground Crayfish", "spices", "lagos-seafood", [o("cup", "1 cup", 1500), o("derica", "1 derica", 3500)], { tags: ["essential", "popular"] }),
  p("Egusi (Ground Melon)", "spices", "mama-ngozi", [o("cup", "1 cup", 1800), o("derica", "1 derica", 4200)], { tags: ["essential"] }),
  p("Ogbono (Ground)", "spices", "mama-ngozi", [o("cup", "1 cup", 2200), o("derica", "1 derica", 5000)], { tags: ["essential"] }),
  p("Seasoning Cubes", "spices", "chika-rice-depot", [o("piece", "Pack of 50", 1200), o("carton", "Carton", 14000)], { tags: ["essential"] }),
  p("Pepper Soup Spice", "spices", "mama-ngozi", [o("piece", "Sachet", 500)], { tags: ["essential"] }),
  // Frozen
  p("Frozen Turkey Wings", "frozen", "fresh-farm-meat", [o("kg", "1 kg", 7800), o("carton", "Carton (10kg)", 74000)], { tags: ["popular"] }),
  p("Frozen Chicken Laps", "frozen", "fresh-farm-meat", [o("kg", "1 kg", 5900), o("carton", "Carton (10kg)", 56000)], { oldPrice: 6400, tags: ["deal"] }),
  // Provisions
  p("Spaghetti 500g", "provisions", "chika-rice-depot", [o("piece", "1 pack", 1100), o("carton", "Carton of 20", 20500)], { tags: ["essential"] }),
  p("Tomato Paste Tin", "provisions", "chika-rice-depot", [o("piece", "1 tin (400g)", 1300), o("carton", "Carton of 24", 29000)], { tags: ["essential"] }),
  p("Powdered Milk 400g", "provisions", "chika-rice-depot", [o("piece", "1 pouch", 3200)], { tags: ["recommended"] }),
  // Wholesale
  p("Rice — 50kg Bag", "wholesale", "chika-rice-depot", [o("bag", "50kg bag", 138000)], { oldPrice: 150000, tags: ["wholesale", "deal"] }),
  p("Beans — 50kg Bag", "wholesale", "mama-ngozi", [o("bag", "50kg bag", 120000)], { tags: ["wholesale"] }),
  p("Garri — 50kg Bag", "wholesale", "mama-ngozi", [o("bag", "50kg bag", 62000)], { tags: ["wholesale"] }),
  p("Palm Oil — 25 Litres", "wholesale", "mama-ngozi", [o("litre", "25 litres", 76000)], { tags: ["wholesale"] }),
];

export const stores: Store[] = [
  { slug: "mama-ngozi", name: "Mama Ngozi Foodstuff", location: "Mile 12 Market, Lagos", rating: 4.8, reviews: 1240, banner: veg, initials: "MN", since: 2009, about: "Family-run stall serving Lagos homes with fresh produce, grains and soup ingredients for over 15 years." },
  { slug: "fresh-farm-meat", name: "Fresh Farm Meat", location: "Oko-Oba Abattoir, Agege", rating: 4.7, reviews: 860, banner: meat, initials: "FF", since: 2015, about: "Hygienically processed chicken, beef and goat meat, cleaned and cut to order." },
  { slug: "chika-rice-depot", name: "Chika Rice Depot", location: "Daleko Market, Mushin", rating: 4.6, reviews: 980, banner: wholesale, initials: "CR", since: 2012, about: "Bulk rice, beans and provisions at wholesale prices for homes, caterers and shops." },
  { slug: "lagos-seafood", name: "Lagos Seafood Market", location: "Makoko Waterfront, Yaba", rating: 4.7, reviews: 640, banner: fish, initials: "LS", since: 2017, about: "Fresh catch every morning — catfish, prawns, crayfish and dried stockfish." },
];

const find = (name: string) => products.find((x) => x.name === name)!.id;

export const recipes: Recipe[] = [
  { slug: "jollof-rice", name: "Jollof Rice", image: rJollof, prepTime: "1 hr 15 mins", serves: 6, difficulty: "Medium", description: "Smoky party-style jollof cooked in a rich tomato and pepper base.",
    ingredients: [{ productId: find("Parboiled Long Grain Rice"), unit: "kg", qty: 2, note: "2 kg rice" }, { productId: find("Fresh Tomatoes"), unit: "kg", qty: 2, note: "Blended" }, { productId: find("Scotch Bonnet Pepper (Ata Rodo)"), unit: "cup", qty: 1, note: "To taste" }, { productId: find("Red Onions"), unit: "kg", qty: 1, note: "Sliced" }, { productId: find("Groundnut Oil"), unit: "litre", qty: 1, note: "For frying" }, { productId: find("Fresh Chicken"), unit: "kg", qty: 2, note: "Seasoned & fried" }, { productId: find("Seasoning Cubes"), unit: "piece", qty: 1, note: "" }],
    steps: ["Blend tomatoes, pepper and half the onions into a smooth paste.", "Fry onions in oil, add tomato paste and the blend; fry for 25 minutes until oil floats.", "Add chicken stock, seasoning, curry and thyme. Taste and adjust.", "Wash rice and add to the pot. Cover with foil and cook on low heat.", "Stir gently when almost done; let the bottom 'burn' slightly for a smoky flavour.", "Serve with fried chicken and plantain."] },
  { slug: "egusi-soup", name: "Egusi Soup", image: rEgusi, prepTime: "1 hr", serves: 6, difficulty: "Medium", description: "Thick melon-seed soup loaded with leafy greens and assorted meat.",
    ingredients: [{ productId: find("Egusi (Ground Melon)"), unit: "cup", qty: 3, note: "Ground" }, { productId: find("Palm Oil"), unit: "litre", qty: 1, note: "" }, { productId: find("Beef (Boneless)"), unit: "kg", qty: 1, note: "Cubed" }, { productId: find("Stockfish (Okporoko)"), unit: "piece", qty: 1, note: "Soaked" }, { productId: find("Ground Crayfish"), unit: "cup", qty: 1, note: "" }, { productId: find("Ugu Leaves"), unit: "piece", qty: 2, note: "Sliced" }],
    steps: ["Boil beef and stockfish with seasoning until tender.", "Heat palm oil, add egusi paste in lumps and fry gently.", "Pour in meat stock and simmer for 15 minutes.", "Add crayfish, pepper and meats.", "Stir in sliced ugu, cook 3 minutes and serve with swallow."] },
  { slug: "ogbono-soup", name: "Ogbono Soup", image: rOgbono, prepTime: "50 mins", serves: 5, difficulty: "Easy", description: "Silky 'draw' soup with ogbono, assorted meat and fish.",
    ingredients: [{ productId: find("Ogbono (Ground)"), unit: "cup", qty: 2, note: "" }, { productId: find("Palm Oil"), unit: "litre", qty: 1, note: "" }, { productId: find("Cow Leg & Kpomo Mix"), unit: "kg", qty: 1, note: "" }, { productId: find("Fresh Catfish"), unit: "piece", qty: 1, note: "" }, { productId: find("Ground Crayfish"), unit: "cup", qty: 1, note: "" }, { productId: find("Okra"), unit: "cup", qty: 1, note: "Optional" }],
    steps: ["Cook meat with seasoning until soft.", "Dissolve ogbono in warm palm oil off the heat.", "Add stock gradually, whisking until it draws.", "Add fish, crayfish and pepper; simmer 10 minutes.", "Finish with okra or greens."] },
  { slug: "fried-rice", name: "Fried Rice", image: rFried, prepTime: "1 hr", serves: 6, difficulty: "Medium", description: "Nigerian-style fried rice with mixed vegetables, liver and chicken.",
    ingredients: [{ productId: find("Parboiled Long Grain Rice"), unit: "kg", qty: 2, note: "" }, { productId: find("Fresh Chicken"), unit: "kg", qty: 1, note: "" }, { productId: find("Red Onions"), unit: "kg", qty: 1, note: "" }, { productId: find("Groundnut Oil"), unit: "litre", qty: 1, note: "" }, { productId: find("Seasoning Cubes"), unit: "piece", qty: 1, note: "" }],
    steps: ["Parboil rice in chicken stock with curry until al dente.", "Stir-fry diced vegetables and liver in batches.", "Fry rice in small batches with oil and onions.", "Combine everything and toss well."] },
  { slug: "pepper-soup", name: "Goat Meat Pepper Soup", image: rPepper, prepTime: "45 mins", serves: 4, difficulty: "Easy", description: "Aromatic, spicy broth — perfect for rainy evenings.",
    ingredients: [{ productId: find("Goat Meat"), unit: "kg", qty: 2, note: "" }, { productId: find("Pepper Soup Spice"), unit: "piece", qty: 2, note: "" }, { productId: find("Scotch Bonnet Pepper (Ata Rodo)"), unit: "cup", qty: 1, note: "" }, { productId: find("Red Onions"), unit: "kg", qty: 1, note: "" }],
    steps: ["Wash goat meat and season with onions and stock cubes.", "Cook until tender, adding water as needed.", "Add pepper soup spice and blended pepper.", "Simmer 10 minutes and finish with scent leaves."] },
  { slug: "oha-soup", name: "Oha Soup", image: rOha, prepTime: "1 hr", serves: 5, difficulty: "Medium", description: "Eastern delicacy thickened with cocoyam and fragrant oha leaves.",
    ingredients: [{ productId: find("Beef (Boneless)"), unit: "kg", qty: 1, note: "" }, { productId: find("Stockfish (Okporoko)"), unit: "piece", qty: 1, note: "" }, { productId: find("Palm Oil"), unit: "litre", qty: 1, note: "" }, { productId: find("Ground Crayfish"), unit: "cup", qty: 1, note: "" }],
    steps: ["Cook meats and stockfish with seasoning.", "Add palm oil and cocoyam paste to thicken.", "Add crayfish and pepper.", "Tear in oha leaves and cook 3 minutes."] },
  { slug: "yam-porridge", name: "Yam Porridge (Asaro)", image: rYam, prepTime: "40 mins", serves: 4, difficulty: "Easy", description: "Comforting yam cooked down in a peppery palm-oil sauce.",
    ingredients: [{ productId: find("Abuja Yam"), unit: "tuber", qty: 1, note: "Peeled & cubed" }, { productId: find("Palm Oil"), unit: "litre", qty: 1, note: "" }, { productId: find("Fresh Tomatoes"), unit: "kg", qty: 1, note: "" }, { productId: find("Ground Crayfish"), unit: "cup", qty: 1, note: "" }, { productId: find("Ugu Leaves"), unit: "piece", qty: 1, note: "" }],
    steps: ["Boil cubed yam with onions and seasoning.", "Add blended pepper, palm oil and crayfish.", "Mash some yam to thicken.", "Stir in greens and serve hot."] },
  { slug: "beans-and-plantain", name: "Beans & Plantain", image: rBeans, prepTime: "1 hr 30 mins", serves: 4, difficulty: "Easy", description: "Creamy beans porridge served with sweet fried dodo.",
    ingredients: [{ productId: find("Brown Beans (Oloyin)"), unit: "kg", qty: 1, note: "" }, { productId: find("Ripe Plantain"), unit: "piece", qty: 1, note: "" }, { productId: find("Palm Oil"), unit: "litre", qty: 1, note: "" }, { productId: find("Red Onions"), unit: "kg", qty: 1, note: "" }],
    steps: ["Pick and wash beans; parboil and drain.", "Cook beans until soft with onions.", "Add palm oil, pepper and crayfish; mash slightly.", "Fry plantain slices until golden and serve together."] },
];

export const demoUser: User = { id: "u1", name: "Chibuike Okafor", email: "chibuike@example.com", phone: "+234 803 000 0000", avatarInitials: "CO", memberSince: "March 2024" };

export const demoAddresses: Address[] = [
  { id: "a1", label: "Home", line: "14 Adeola Odeku Street, Victoria Island", city: "Lagos", state: "Lagos", phone: "+234 803 000 0000", isDefault: true },
  { id: "a2", label: "Office", line: "Plot 5, Admiralty Way, Lekki Phase 1", city: "Lekki", state: "Lagos", phone: "+234 803 000 0001" },
];

export const demoOrders: Order[] = [
  { id: "NF-10482", date: "2026-10-10", status: "Out for delivery", total: 28450, items: [{ name: "Local Rice", qty: 2, unitLabel: "1 kg", image: rice }, { name: "Fresh Chicken", qty: 2, unitLabel: "1 kg", image: meat }, { name: "Fresh Tomatoes", qty: 1, unitLabel: "Small basket", image: veg }] },
  { id: "NF-10391", date: "2026-10-02", status: "Delivered", total: 15700, items: [{ name: "Palm Oil", qty: 1, unitLabel: "5 litres", image: oil }] },
  { id: "NF-10217", date: "2026-09-21", status: "Delivered", total: 152000, items: [{ name: "Rice — 50kg Bag", qty: 1, unitLabel: "50kg bag", image: wholesale }, { name: "Seasoning Cubes", qty: 2, unitLabel: "Pack of 50", image: spices }] },
  { id: "NF-10102", date: "2026-09-08", status: "Cancelled", total: 9800, items: [{ name: "Tiger Prawns", qty: 1, unitLabel: "500 g", image: fish }] },
];

export const nigerianStates = ["Lagos", "Abuja (FCT)", "Rivers", "Oyo", "Enugu", "Anambra", "Kano", "Delta", "Ogun", "Kaduna", "Edo", "Imo"];

export const DELIVERY_FEE = 1500;
