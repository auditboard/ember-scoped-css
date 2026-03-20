import path from 'node:path';

const KEY = 'ember-scoped.css';
const SEP = '___';

export const request = {
  is: {
    inline(request) {
      return request.includes(KEY);
    },
    colocated(request) {
      return request.includes('.css?scoped=');
    },
  },
  inline: {
    /**
     * Makes request URL for embedding `<style>` as `<link>` into the `<head>`
     *
     * @param {string} cssHash the hash of the CSS contents
     * @param {string} postfix the hash of the file that _includes_ the linked file
     * @param {string} cssContents the contents of the CSS file
     * @param {string} [lang] optional preprocessor language (e.g. 'scss', 'sass', 'less')
     */
    create(cssHash, postfix, cssContents, lang) {
      let url = `./${postfix}${SEP}${cssHash}.${KEY}?css=${encodeURIComponent(cssContents)}`;

      if (lang) {
        url += `&lang=${encodeURIComponent(lang)}`;
      }

      return url;
    },
    decode(request) {
      let [left, qps] = request.split('?');

      left = left.slice(2).replace(`.${KEY}`, '');

      let [postfix, hash] = left.split(SEP);

      let search = new URLSearchParams(qps);

      return {
        hash,
        postfix,
        css: search.get('css'),
        from: search.get('from'),
        lang: search.get('lang'),
      };
    },
  },
  colocated: {
    /**
     * Makes request URL for embedding separate CSS File as `<link>` into the `<head>`
     *
     * @param {string} cssHash the hash of the CSS contents
     * @param {string} postfix the hash of the file that _includes_ the linked file
     * @param {string} filePath path to the separate CSS File
     */
    create(cssHash, postfix, filePath) {
      return `./${path.basename(filePath)}?scoped=${postfix}&cssHash=${cssHash}`;
    },
    decode(request) {
      const [fileName, qs] = request.split('?');
      const search = new URLSearchParams(qs);

      return {
        fileName,
        cssHash: search.get('cssHash'),
        postfix: search.get('scoped'),
      };
    },
  },
};
