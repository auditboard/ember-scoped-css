/**
 * This declaration file teaches TypeScript (via Glint) about the special
 * attributes that ember-scoped-css adds to the `<style>` element,
 * so that `<style scoped>` and `<style inline>` type-check.
 *
 * Add it to your tsconfig.json:
 *
 * ```jsonc
 * {
 *   "compilerOptions": {
 *     "types": ["ember-scoped-css/types"]
 *   }
 * }
 * ```
 *
 * or, if you don't use `compilerOptions.types`, import it from a
 * type-declaration file that is included in your project:
 *
 * ```ts
 * import 'ember-scoped-css/types';
 * ```
 */
import '@glint/template';

declare global {
  interface HTMLStyleElementAttributes {
    scoped: '';
    inline: '';
  }
}
