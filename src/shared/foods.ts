// A built-in list of everyday foods (per serving). Online search (Open Food Facts) adds packaged foods.

export type Food = { name: string; serving: string; kcal: number; protein: number; carbs: number; fat: number; brand?: string };

type Row = [string, string, number, number, number, number];

const ROWS: Row[] = [
  // Protein
  ["Chicken breast, cooked", "4 oz (112 g)", 187, 35, 0, 4],
  ["Chicken thigh, cooked", "4 oz (112 g)", 232, 28, 0, 13],
  ["Ground beef 90/10, cooked", "4 oz (112 g)", 245, 29, 0, 14],
  ["Ground beef 80/20, cooked", "4 oz (112 g)", 307, 28, 0, 21],
  ["Ground turkey 93/7, cooked", "4 oz (112 g)", 200, 26, 0, 11],
  ["Sirloin steak, cooked", "6 oz (170 g)", 330, 50, 0, 13],
  ["Ribeye steak, cooked", "6 oz (170 g)", 480, 42, 0, 34],
  ["Salmon, cooked", "4 oz (112 g)", 234, 25, 0, 14],
  ["Tilapia, cooked", "4 oz (112 g)", 145, 30, 0, 3],
  ["Shrimp, cooked", "4 oz (112 g)", 112, 27, 0, 0.3],
  ["Tuna, canned in water", "1 can (142 g)", 120, 26, 0, 1],
  ["Pork chop, cooked", "4 oz (112 g)", 230, 30, 0, 11],
  ["Bacon", "3 slices", 129, 9, 0.4, 10],
  ["Turkey deli meat", "2 oz (56 g)", 60, 11, 2, 1],
  ["Egg, large", "1 egg", 72, 6.3, 0.4, 4.8],
  ["Egg whites", "1/2 cup (120 g)", 63, 13, 0.9, 0.2],
  ["Tofu, firm", "1/2 cup (126 g)", 181, 22, 3.5, 11],
  ["Beef jerky", "1 oz (28 g)", 116, 9.4, 3.1, 7.3],
  ["Chicken wings", "6 wings", 430, 38, 0, 30],
  ["Chicken nuggets", "10 pieces", 410, 23, 25, 24],
  // Dairy & shakes
  ["Whey protein", "1 scoop (30 g)", 120, 24, 3, 1.5],
  ["Protein shake with 2% milk", "1 scoop + 1 cup milk", 242, 32, 15, 6],
  ["Greek yogurt, nonfat plain", "1 container (170 g)", 100, 17, 6, 0.7],
  ["Cottage cheese, low fat", "1 cup (226 g)", 163, 28, 6, 2.3],
  ["Milk, 2%", "1 cup (240 ml)", 122, 8, 12, 4.8],
  ["Milk, whole", "1 cup (240 ml)", 149, 8, 12, 8],
  ["Chocolate milk", "1 cup (240 ml)", 190, 8, 26, 5],
  ["Cheddar cheese", "1 oz (28 g)", 113, 7, 0.4, 9.3],
  ["String cheese", "1 stick", 80, 7, 1, 6],
  ["Protein bar", "1 bar", 200, 20, 22, 7],
  ["Ice cream", "1/2 cup", 137, 2.3, 16, 7],
  // Carbs
  ["White rice, cooked", "1 cup (158 g)", 205, 4.3, 45, 0.4],
  ["Brown rice, cooked", "1 cup (195 g)", 216, 5, 45, 1.8],
  ["Jasmine rice, cooked", "1 cup (158 g)", 205, 4.2, 45, 0.4],
  ["Oats, dry", "1/2 cup (40 g)", 150, 5, 27, 3],
  ["Pasta, cooked", "1 cup (140 g)", 220, 8, 43, 1.3],
  ["Quinoa, cooked", "1 cup (185 g)", 222, 8, 39, 3.6],
  ["Potato, baked", "1 medium (173 g)", 161, 4.3, 37, 0.2],
  ["Sweet potato, baked", "1 medium (130 g)", 112, 2, 26, 0.1],
  ["Bread, whole wheat", "1 slice", 80, 4, 14, 1],
  ["Bread, white", "1 slice", 75, 2.5, 14, 1],
  ["Bagel, plain", "1 bagel", 270, 11, 53, 1.5],
  ["Flour tortilla (8 in)", "1 tortilla", 146, 3.8, 25, 3.6],
  ["Corn tortilla", "1 tortilla", 52, 1.4, 11, 0.7],
  ["Black beans", "1/2 cup", 114, 7.6, 20, 0.5],
  ["Rice cake", "1 cake", 35, 0.7, 7.3, 0.3],
  ["Cereal with 2% milk", "1 cup + 1/2 cup milk", 222, 11, 32, 6],
  ["Granola", "1/2 cup", 300, 7, 38, 14],
  ["Pancakes", "3 medium", 350, 9, 60, 8],
  ["Maple syrup", "2 tbsp", 104, 0, 27, 0],
  ["Ramen, instant", "1 pack", 380, 8, 52, 14],
  ["Fried rice", "1 cup", 238, 5.5, 45, 4],
  // Fruit & veg
  ["Banana", "1 medium", 105, 1.3, 27, 0.4],
  ["Apple", "1 medium", 95, 0.5, 25, 0.3],
  ["Orange", "1 medium", 62, 1.2, 15, 0.2],
  ["Blueberries", "1 cup", 84, 1.1, 21, 0.5],
  ["Strawberries", "1 cup", 49, 1, 12, 0.5],
  ["Grapes", "1 cup", 104, 1.1, 27, 0.2],
  ["Avocado", "1/2 avocado", 120, 1.5, 6, 11],
  ["Broccoli", "1 cup", 31, 2.5, 6, 0.3],
  ["Green beans", "1 cup", 31, 1.8, 7, 0.2],
  ["Salad greens", "2 cups", 20, 1.5, 4, 0.2],
  ["Spinach", "1 cup raw", 7, 0.9, 1.1, 0.1],
  // Fats & snacks
  ["Peanut butter", "2 tbsp", 190, 7, 7, 16],
  ["Almonds", "1 oz (28 g)", 164, 6, 6, 14],
  ["Trail mix", "1/4 cup", 175, 5, 17, 11],
  ["Olive oil", "1 tbsp", 119, 0, 0, 13.5],
  ["Butter", "1 tbsp", 102, 0.1, 0, 11.5],
  ["Hummus", "2 tbsp", 70, 2, 4, 5],
  ["Dark chocolate", "1 oz (28 g)", 170, 2.2, 13, 12],
  ["Potato chips", "1 oz (28 g)", 160, 2, 15, 10],
  ["Oreo cookies", "3 cookies", 160, 1, 25, 7],
  ["Honey", "1 tbsp", 64, 0, 17, 0],
  // Meals
  ["Chicken & rice meal prep", "6 oz chicken + 1 cup rice", 530, 58, 50, 7],
  ["Burrito bowl (chicken)", "1 bowl", 650, 45, 70, 20],
  ["Burger with bun", "1/4 lb burger", 540, 30, 40, 28],
  ["Big Mac", "1 sandwich", 590, 25, 46, 34],
  ["Fries, medium", "1 order", 320, 5, 43, 15],
  ["Pizza, cheese", "1 large slice", 285, 12, 36, 10],
  ["Pizza, pepperoni", "1 large slice", 313, 13, 35, 13],
  ["PB&J sandwich", "1 sandwich", 380, 13, 45, 17],
  ["Chicken Caesar salad", "1 bowl", 450, 35, 15, 28],
  ["Sushi roll (California)", "8 pieces", 255, 9, 38, 7],
  // Drinks
  ["Orange juice", "1 cup", 112, 1.7, 26, 0.5],
  ["Soda", "12 oz can", 140, 0, 39, 0],
  ["Energy drink", "16 oz can", 210, 0, 54, 0],
  ["Energy drink, zero sugar", "16 oz can", 10, 0, 3, 0],
  ["Sports drink", "20 oz bottle", 140, 0, 36, 0],
  ["Latte with 2% milk", "16 oz", 190, 13, 19, 7],
  ["Black coffee", "1 cup", 2, 0.3, 0, 0],
  ["Beer", "12 oz", 153, 1.6, 13, 0],
];

export const FOODS: Food[] = ROWS.map(([name, serving, kcal, protein, carbs, fat]) => ({ name, serving, kcal, protein, carbs, fat }));

export function searchFoods(q: string, limit = 12): Food[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return FOODS.map((f) => {
    const n = f.name.toLowerCase();
    if (!words.every((w) => n.includes(w))) return null;
    return { f, score: (n.startsWith(words[0]) ? 0 : 1) + n.length / 100 };
  })
    .filter((x): x is { f: Food; score: number } => !!x)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.f);
}
