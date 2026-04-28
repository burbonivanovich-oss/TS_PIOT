export function termSlug(term: string): string {
	return term
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[^а-яa-z0-9]+/gu, '-')
		.replace(/^-+|-+$/g, '');
}

const RU_ALPHABET = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.toUpperCase().split('');
const EN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase().split('');

export function firstLetter(term: string): string {
	const ch = term.trim().charAt(0).toUpperCase();
	if (ch === 'Ё') return 'Е';
	return ch;
}

export function alphabetOrder(a: string, b: string): number {
	const ia = indexOf(a);
	const ib = indexOf(b);
	if (ia !== ib) return ia - ib;
	return a.localeCompare(b, 'ru');
}

function indexOf(letter: string): number {
	const ru = RU_ALPHABET.indexOf(letter);
	if (ru >= 0) return ru;
	const en = EN_ALPHABET.indexOf(letter);
	if (en >= 0) return RU_ALPHABET.length + en;
	return RU_ALPHABET.length + EN_ALPHABET.length;
}
