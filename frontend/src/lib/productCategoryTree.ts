export interface CategoryNode {
  name: string;
  children?: CategoryNode[];
}

export const PRODUCT_CATEGORY_TREE: CategoryNode[] = [
  {
    name: 'Продукты питания',
    children: [
      { name: 'Овощи, фрукты, зелень' },
      { name: 'Мясо, птица, рыба' },
      { name: 'Молочные продукты и яйца' },
      { name: 'Бакалея' },
      { name: 'Хлеб и выпечка' },
      { name: 'Заморозка' },
      { name: 'Готовая еда и кулинария' },
      { name: 'Колбасы и деликатесы' },
      { name: 'Сладости и десерты' },
      { name: 'Снеки' },
      { name: 'Детское питание' },
      { name: 'Диетическое и специализированное питание' },
      { name: 'Эко и фермерские продукты' },
    ],
  },
  {
    name: 'Напитки',
    children: [
      { name: 'Вода' },
      { name: 'Соки, нектары, морсы' },
      { name: 'Газированные напитки' },
      { name: 'Кофе' },
      { name: 'Чай' },
      { name: 'Какао и горячий шоколад' },
      { name: 'Безалкогольные напитки' },
    ],
  },
  {
    name: 'Товары для дома',
    children: [
      { name: 'Бытовая химия' },
      { name: 'Бумажная продукция' },
      { name: 'Хозяйственные товары' },
      { name: 'Товары для хранения' },
    ],
  },
  {
    name: 'Личная гигиена и уход',
    children: [
      { name: 'Уход за телом' },
      { name: 'Уход за волосами' },
      { name: 'Уход за полостью рта' },
      { name: 'Бритье и депиляция' },
      { name: 'Женская гигиена' },
    ],
  },
  {
    name: 'Товары для детей',
    children: [
      { name: 'Подгузники и пеленки' },
      { name: 'Детская гигиена' },
      { name: 'Аксессуары для кормления' },
    ],
  },
  {
    name: 'Товары для животных',
    children: [
      { name: 'Корма для кошек' },
      { name: 'Корма для собак' },
      { name: 'Уход и аксессуары' },
    ],
  },
  {
    name: 'Сезонные товары и акции',
    children: [
      { name: 'Пикник и гриль' },
      { name: 'Праздничные товары' },
      { name: 'Товары по акции' },
    ],
  },
];

export function flattenCategoryTree(tree: CategoryNode[]): string[] {
  const result: string[] = [];

  const visit = (nodes: CategoryNode[]) => {
    nodes.forEach((node) => {
      result.push(node.name);
      if (node.children?.length) {
        visit(node.children);
      }
    });
  };

  visit(tree);
  return result;
}
