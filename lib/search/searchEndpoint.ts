const DEFAULT_SEARCH_FUNCTION_URL = 'https://us-central1-seriph.cloudfunctions.net/searchFontsHttpUs';

export function searchFunctionUrl(environment: { SEARCH_FUNCTION_URL?: string }): string {
  return environment.SEARCH_FUNCTION_URL || DEFAULT_SEARCH_FUNCTION_URL;
}
