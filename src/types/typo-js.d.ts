declare module 'typo-js' {
  class Typo {
    constructor(language: string, affixData: string, dictionaryData: string);
    check(word: string): boolean;
    suggest(word: string): string[];
  }
  export default Typo;
}
