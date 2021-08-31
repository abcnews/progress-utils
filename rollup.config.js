import babel from 'rollup-plugin-babel';
import css from 'rollup-plugin-css-only';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import svelte from 'rollup-plugin-svelte';

export default {
  input: 'example/src/index.js',
  output: {
    file: 'example/public/index.js',
    format: 'iife',
  },
  plugins: [
    svelte(),
    css({ output: 'index.css' }),
    babel({
      exclude: 'node_modules/**',
    }),
    commonjs(),
    resolve({ preferBuiltins: false }),
    serve({ contentBase: 'example/public', open: true }),
  ],
};
