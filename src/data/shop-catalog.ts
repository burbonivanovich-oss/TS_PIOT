// Каталог-магазин /produkty/ в формате интернет-магазина.
// REF_SECTIONS сгенерированы scripts/shop/sync-feed.mjs из эталонного
// фида (https://workhardmarish.github.io/kontur-feed/, цены на 2026-06-06). Не редактировать вручную —
// перегенерировать скриптом. Наши сервисы Контура, которых нет в фиде,
// добавляются секцией «Сервисы и софт Контура» из STOREFRONT_PRODUCTS
// (gated по erid, цена — заглушка).
import { CPA_BANNERS, STOREFRONT_PRODUCTS } from './cpa-banners';

export interface ShopItem {
	id: string;
	slug?: string;
	name: string;
	desc: string;
	img?: string;
	visual?: { abbrev: string; bg: string };
	cat?: string;
	price: number | null;
	priceLabel: string;
	oldPrice?: number | null;
	oldLabel?: string;
	badge?: string;
	kit?: boolean;
	href?: string;
}

export interface ShopSection {
	id: string;
	eye: string;
	color: string;
	title: string;
	items: ShopItem[];
}

export const PRICE_DATE = '2026-06-06';

const REF_SECTIONS: ShopSection[] = [
  {
    "id": "kasses",
    "eye": "Кассы",
    "color": "#FF6B35",
    "title": "Кассы и POS-терминалы",
    "items": [
      {
        "id": "7",
        "slug": "atol-30f",
        "name": "Онлайн касса Атол 30Ф",
        "desc": "Онлайн касса работает в паре с POS-терминалом, ПК, ноутбуком, планшетом или даже смартфоном. Готов к работе с маркировко",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/7i/dcc04420-04d5-4d9c-9a3f-cdb61cb78421.png?t=1776775279",
        "cat": "Кассы",
        "price": 68930,
        "priceLabel": "68 930 ₽"
      },
      {
        "id": "6",
        "slug": "atol-27f",
        "name": "Онлайн касса чеков Атол 27Ф",
        "desc": "Онлайн касса работает в паре с POS-терминалом, ПК, ноутбуком, планшетом или даже смартфоном.",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/6i/7419be63-9635-49cb-8e93-b9ab776297cf.png?t=1776774940",
        "cat": "Кассы",
        "price": 39500,
        "priceLabel": "39 500 ₽"
      },
      {
        "id": "5",
        "slug": "mspos-t",
        "name": "Касса MSPOS‑T‑Ф D3 Mini",
        "desc": "Касса MSPOS-T-Ф D3 Mini с большим экраном и встроенным принтером чеков подходит кафе и магазинам",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/5i/6840b2ac-6992-41c3-9291-a48c6d191de9.png?t=1776773632",
        "cat": "Кассы",
        "price": 38430,
        "priceLabel": "38 430 ₽"
      },
      {
        "id": "4",
        "slug": "mspos-f20",
        "name": "Мобильная касса MSPOS‑F20‑Ф",
        "desc": "Мобильная касса MSPOS‑F20‑Ф подходит курьерам, маленьким магазинам, кофейням и салонам. Готова к маркировке",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/4i/4b83aa41-cf8f-4132-8810-3595c71b2f06.png?t=1776773407",
        "cat": "Кассы",
        "price": 22570,
        "priceLabel": "22 570 ₽"
      },
      {
        "id": "9",
        "slug": "paytor-jay-pro",
        "name": "POS‑терминал PayTor Jay Pro",
        "desc": "PayTor Jay Pro современный POS-терминал, объединяющий в себе высокую производительность, элегантный внешний вид и прочну",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/9i/06382d5f-0aae-4ace-915d-9abdc11e8f88.png?t=1776775508",
        "cat": "Кассы",
        "price": 48800,
        "priceLabel": "48 800 ₽"
      },
      {
        "id": "10",
        "slug": "edpos",
        "name": "POS‑терминал EdPOS",
        "desc": "POS-терминал EdPOS подходит магазинам, кофейням, салонам и сфере услуг",
        "img": "https://s.kontur.ru/common-v2/icons-products/market/avatar/market-avatar-512.png",
        "cat": "Кассы",
        "price": 30012,
        "priceLabel": "30 012 ₽"
      },
      {
        "id": "8",
        "slug": "atol-optima",
        "name": "POS‑терминал Атол Optima",
        "desc": "POS-терминал Атол Optima подходит магазинам и заведениям с большим потоком клиентов.",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/8i/5b806055-430b-49c4-8e87-96d338f23c6c.png?t=1777896735",
        "cat": "Кассы",
        "price": 42944,
        "priceLabel": "42 944 ₽"
      }
    ]
  },
  {
    "id": "kits",
    "eye": "Комплекты",
    "color": "#00C896",
    "title": "Готовые кассовые комплекты",
    "items": [
      {
        "id": "14",
        "slug": "kit-mobilnyj",
        "name": "Кассовый комплект «Мобильный с эквайрингом»",
        "desc": "Готовое решение для продуктовой и непродуктовой розницы, точек общепита и сферы услуг. В комплект входят мобильная касса",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/14i/35822efc-46fe-4dcf-8c8a-01d0be4f45f2.png?t=1776779206",
        "cat": "",
        "price": 29214,
        "priceLabel": "29 213 ₽",
        "oldPrice": 30838,
        "oldLabel": "30 838 ₽",
        "badge": "Скидка",
        "kit": true
      },
      {
        "id": "15",
        "slug": "kit-vygodnyj",
        "name": "Кассовый комплект «Выгодный»",
        "desc": "Готовое решение для непродуктовой розницы, точек общепита и сферы услуг. В комплект входят фискальный принтер чеков Атол",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/15i/a15c53bc-5a93-4dd7-91ed-55cbc9394bae.png?t=1776779764",
        "cat": "",
        "price": 32630,
        "priceLabel": "32 629 ₽",
        "oldPrice": 34254,
        "oldLabel": "34 254 ₽",
        "badge": "Скидка",
        "kit": true
      },
      {
        "id": "12",
        "slug": "kit-udobnyj",
        "name": "Кассовый комплект «Удобный»",
        "desc": "Готовое решение для продуктовой и непродуктовой розницы, точек общепита и сферы услуг. В комплект входят Касса MSPOS-T-Ф",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/12i/8f7e876f-8da2-44a5-af73-3e617ae5d201.png?t=1776778742",
        "cat": "",
        "price": 45074,
        "priceLabel": "45 073 ₽",
        "oldPrice": 46698,
        "oldLabel": "46 698 ₽",
        "badge": "Скидка",
        "kit": true
      },
      {
        "id": "11",
        "slug": "kit-nadezhnyj",
        "name": "Кассовый комплект «Надежный»",
        "desc": "Готовое решение для продуктовой и непродуктовой розницы, точек общепита и сферы услуг. В комплект входят POS-терминал Ат",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/11i/3e0edf39-6ee5-4e08-a289-b7e0b45f69d6.png?t=1776778394",
        "cat": "",
        "price": 72524,
        "priceLabel": "72 523 ₽",
        "oldPrice": 74148,
        "oldLabel": "74 148 ₽",
        "badge": "Скидка",
        "kit": true
      },
      {
        "id": "13",
        "slug": "kit-bystryj",
        "name": "Кассовый комплект «Быстрый»",
        "desc": "Готовое решение для продуктовой и непродуктовой розницы, точек общепита и сферы услуг. В комплект входят POS-терминал Ат",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/13i/f82380ac-4d85-4bae-8a7d-30073b1d8908.png?t=1776778991",
        "cat": "",
        "price": 86038,
        "priceLabel": "86 037 ₽",
        "oldPrice": 87662,
        "oldLabel": "87 662 ₽",
        "badge": "Скидка",
        "kit": true
      }
    ]
  },
  {
    "id": "fn-ofd",
    "eye": "ФН и ОФД",
    "color": "#3D7FFF",
    "title": "Фискальные накопители",
    "items": [
      {
        "id": "17",
        "slug": "fn-36",
        "name": "Фискальный накопитель на 36 месяцев",
        "desc": "Для работы по 54‑ФЗ нужна касса, а еще фискальный накопитель и оператор фискальных данных. Совмещение с ОСНО. Продажа по",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/17i/84156a88-4490-432b-8b2d-7b05d35d7995.png?t=1776847304",
        "cat": "Фискальные накопители",
        "price": 23100,
        "priceLabel": "23 100 ₽"
      },
      {
        "id": "16",
        "slug": "fn-15",
        "name": "Фискальный накопитель на 15 месяцев",
        "desc": "Для работы по 54‑ФЗ нужна касса, а еще фискальный накопитель и оператор фискальных данных. Совмещение с ОСНО. Продажа по",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/16i/45da6129-24cb-4749-b7d3-348c1573031a.png?t=1776847251",
        "cat": "Фискальные накопители",
        "price": 15900,
        "priceLabel": "15 900 ₽"
      }
    ]
  },
  {
    "id": "ofd",
    "eye": "ФН и ОФД",
    "color": "#3D7FFF",
    "title": "Контур.ОФД и комплекты ФН+ОФД",
    "items": [
      {
        "id": "22",
        "slug": "ofd-36",
        "name": "Оператор фискальных данных на 36 месяцев",
        "desc": "ОФД - Передача фискальных данных в ФНС, работа с маркировкой, контроль выручки, возвратов, среднего чека и смен и другое",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/22i/e42c0cd8-d6a6-4ea0-aa01-32b8aad41e53.png?t=1776847696",
        "cat": "ОФД",
        "price": 12000,
        "priceLabel": "12 000 ₽"
      },
      {
        "id": "19",
        "slug": "fn-ofd-36",
        "name": "Комплект: Фискальный Накопитель + ОФД на 36 месяцев",
        "desc": "Выгодный комплект фискальный накопитель и ОФД на 36 месяцев для работы по 54-ФЗ",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/19i/ee72ae09-9a07-45b6-993f-470820908654.png?t=1776847531",
        "cat": "ОФД",
        "price": 35100,
        "priceLabel": "35 100 ₽"
      },
      {
        "id": "20",
        "slug": "ofd-13",
        "name": "Оператор фискальных данных на 13 месяцев",
        "desc": "ОФД - Передача фискальных данных в ФНС, работа с маркировкой, контроль выручки, возвратов, среднего чека и смен и другое",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/20i/38066f1f-bfd8-4b87-8907-3b302e78786f.png?t=1776847613",
        "cat": "ОФД",
        "price": 5000,
        "priceLabel": "5 000 ₽"
      },
      {
        "id": "21",
        "slug": "ofd-15",
        "name": "Оператор фискальных данных на 15 месяцев",
        "desc": "ОФД - Передача фискальных данных в ФНС, работа с маркировкой, контроль выручки, возвратов, среднего чека и смен и другое",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/21i/c1d0d06f-9bf6-436c-8424-1ca573181c5b.png?t=1776847659",
        "cat": "ОФД",
        "price": 5300,
        "priceLabel": "5 300 ₽"
      },
      {
        "id": "18",
        "slug": "fn-ofd-15",
        "name": "Комплект: Фискальный Накопитель + ОФД на 15 месяцев",
        "desc": "Выгодный комплект фискальный накопитель и ОФД на 15 месяцев для работы по 54-ФЗ",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/18i/49c681d4-77f5-4b0c-981d-63ea73e2cf41.png?t=1776847461",
        "cat": "ОФД",
        "price": 21200,
        "priceLabel": "21 200 ₽"
      }
    ]
  },
  {
    "id": "edo",
    "eye": "ЭДО",
    "color": "#7B61FF",
    "title": "Контур.Диадок — ЭДО",
    "items": [
      {
        "id": "27",
        "slug": "diadok-1200",
        "name": "Контур.Диадок — 1200 исходящих в ЭДО",
        "desc": "10,25₽ документ.  Новым пользователям 25 исходящих на 30 дней в подарок.",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/27i/4f5f0915-498a-4994-b782-9b7148bad240.png?t=1777044373",
        "cat": "ЭДО",
        "price": 12300,
        "priceLabel": "12 300 ₽"
      },
      {
        "id": "26",
        "slug": "diadok-600",
        "name": "Контур.Диадок — 600 исходящих в ЭДО",
        "desc": "10,50₽ документ.  Новым пользователям 25 исходящих на 30 дней в подарок.",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/26i/b8f9f30e-2a6d-4670-a02e-e48555f6926a.png?t=1777044136",
        "cat": "ЭДО",
        "price": 6300,
        "priceLabel": "6 300 ₽"
      },
      {
        "id": "2",
        "slug": "diadok",
        "name": "Контур.Диадок — 250 исходящих в ЭДО",
        "desc": "11,80₽ документ.  Новым пользователям 25 исходящих на 30 дней в подарок.",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/2i/53e2849c-6c5e-4799-a458-18622ee5a4a1.png?t=1777038716",
        "cat": "ЭДО",
        "price": 2950,
        "priceLabel": "2 950 ₽"
      },
      {
        "id": "28",
        "slug": "diadok-3000",
        "name": "Контур.Диадок — 3000 исходящих в ЭДО",
        "desc": "9,87₽ документ.  Новым пользователям 25 исходящих на 30 дней в подарок.",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/28i/2eaaf7ba-01ce-49c9-bb9d-9e2791efb788.png?t=1777044502",
        "cat": "ЭДО",
        "price": 29600,
        "priceLabel": "29 600 ₽"
      }
    ]
  },
  {
    "id": "periphery",
    "eye": "Периферия",
    "color": "#FF6B35",
    "title": "Периферия",
    "items": [
      {
        "id": "1",
        "slug": "pereiferia",
        "name": "Денежный ящик «Компакт»",
        "desc": "Денежный ящик подходит для предпринимателей, которые работают с наличными деньгами",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/1i/72e85cf5-aa83-480b-ae4a-fd3732f3b003.png?t=1776763853",
        "cat": "Товароучетная система",
        "price": 5368,
        "priceLabel": "5 368 ₽"
      },
      {
        "id": "23",
        "slug": "scanner-neo-max",
        "name": "2D Сканер NEO MAX SD",
        "desc": "2D Сканер NEO MAX SD подходит для торговых точек с большим ассортиментом, а также для продавцов маркированных товаров и",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/23i/f9daf0dd-069d-416e-8ed5-9b975a73bed2.png?t=1776848196",
        "cat": "Кассы",
        "price": 9394,
        "priceLabel": "9 394 ₽"
      },
      {
        "id": "25",
        "slug": "atol-jett",
        "name": "Принтер Атол Jett для печати заказов",
        "desc": "Принтер подходит любым заведениям общепита, где касса находится в удалении от барной стойки или кухни",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/25i/9f5d7a94-2943-402f-b4d2-0582ba179b4b.png?t=1776848353",
        "cat": "Кассы",
        "price": 15372,
        "priceLabel": "15 372 ₽"
      },
      {
        "id": "24",
        "slug": "scanner-mindeo-mp8610",
        "name": "Стационарный 2D Сканер Mindeo MP8610",
        "desc": "Сканер подходит для магазинов с высокой пропускной способностью, а также для магазинов, в которых продают маркированные",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/24i/ba750184-ea7a-4cdf-a327-f8fb8bc9c60d.png?t=1776848258",
        "cat": "Кассы",
        "price": 20130,
        "priceLabel": "20 130 ₽"
      },
      {
        "id": "3",
        "slug": "scanner-mindeo-md6600",
        "name": "2D Сканер Mindeo MD6600‑HD",
        "desc": "Удобный ручной сканер. Автораспознавание кодов и поддержка ручного и автоматического режимов сканирования.",
        "img": "https://kontur.ru/Files/Modules/YmlOffer/3i/c591c2ac-52e0-463e-b607-e0e9f04f1b26.png?t=1776764477",
        "cat": "Товароучетная система",
        "price": 6100,
        "priceLabel": "6 100 ₽"
      }
    ]
  }
];

// Наши сервисы Контура, которых нет в фиде. Берём только офферы с
// erid (STOREFRONT_PRODUCTS), исключая те, что уже есть в фиде.
const REF_OVERLAP = ['kontur-market', 'kontur-ofd', 'kontur-diadoc'];
const ourItems: ShopItem[] = STOREFRONT_PRODUCTS
	.filter(p => !REF_OVERLAP.includes(p.bannerId))
	.map(p => {
		const b = CPA_BANNERS[p.bannerId];
		return {
			id: 'svc-' + p.bannerId,
			name: b.eyebrow.replace(/^Реклама\s*·\s*/u, '').trim(),
			desc: b.description,
			visual: b.visual,
			cat: 'Сервисы Контура',
			price: null,
			priceLabel: 'по запросу',
			href: `/produkty/${p.slug}/`,
		};
	});

const OUR_SECTION: ShopSection = {
	id: 'servisy',
	eye: 'Сервисы',
	color: '#ff4d8f',
	title: 'Сервисы и софт Контура',
	items: ourItems,
};

export const SHOP_SECTIONS: ShopSection[] = [...REF_SECTIONS, OUR_SECTION];
