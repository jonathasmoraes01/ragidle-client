import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = path => readFileSync(`src/UI/Components/${path}`, 'utf8');
const selection = new JSDOM(read('CharSelect/CharSelectV4/CharSelectV4.html')).window.document;
const creation = new JSDOM(read('CharCreate/CharCreatev4/CharCreatev4.html')).window.document;

describe('Contrato das telas premium de personagem', () => {
 it('mantém os quinze canvas e suas dimensões nativas dentro da composição', () => {
  expect(selection.querySelectorAll('canvas')).toHaveLength(15);
  for (let i = 0; i < 15; i++) {
   const canvas = selection.querySelector(`#slot${i}`);
   expect(canvas.closest('.pg-panel')).not.toBeNull();
   expect(canvas.getAttribute('width')).toBe('157');
   expect(canvas.getAttribute('height')).toBe('195');
  }
 });
 it('mantém a ficha intacta após a limpeza usada pelos slots vazios', () => {
  const info = selection.querySelector('.charinfo').cloneNode(true);
  info.querySelectorAll('div').forEach(node => { node.textContent = ''; });
  for (const key of ['str', 'agi', 'vit', 'int', 'dex', 'luk']) {
   expect(info.querySelector(`.${key}`)).not.toBeNull();
  }
  expect(info.querySelector('.pg-section-title').textContent).toBe('Ficha do personagem');
  expect(info.querySelectorAll('button')).toHaveLength(4);
 });
 it('preserva os três modelos e os grupos de aparência com labels associados', () => {
  for (const id of ['human', 'doram', 'style_model']) {
   const canvas = creation.querySelector(`canvas#${id}`);
   expect(canvas.getAttribute('width')).toBe('65');
   expect(canvas.getAttribute('height')).toBe('110');
  }
  for (const radio of creation.querySelectorAll('input[type="radio"]')) {
   expect(creation.querySelector(`label[for="${radio.id}"]`)).not.toBeNull();
  }
  expect(creation.querySelectorAll('.hcolor')).toHaveLength(9);
  expect(creation.querySelector('#char_name').getAttribute('maxlength')).toBe('24');
 });
 it('usa controles nativos e compartilha logo e moldura entre as telas', () => {
  for (const doc of [selection, creation]) {
   expect(doc.querySelector('.pg-logo').getAttribute('src')).toBe('/ragidle/login/logo-classic-idle.webp');
   expect(doc.querySelectorAll('.pg-screen .pg-composition .pg-panel')).toHaveLength(1);
   expect(doc.querySelectorAll('h1')).toHaveLength(1);
   for (const button of doc.querySelectorAll('button')) { expect(button.type).toBe('button'); }
  }
 });
});
