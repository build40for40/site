// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import DayBox from './DayBox.vue';
import { history } from '../data/days';

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => vi.unstubAllGlobals());
function render(day: number) {
  return mount(DayBox, { props: {
    entry: { key: `day-${day}`, day, date: 'Thu 19 Nov', status: 'shipped', idea: history[day] },
    days: [], pool: [], today: 14, isToday: true, now: Date.parse('2026-11-19T18:00:00Z'),
    amount: 40, backed: false, headline: { tone: '', dot: '', text: 'Shipped' },
  }});
}
test('plays the product demo by default while retaining the separate full build', async () => {
  const wrapper = render(14);
  expect(wrapper.findAll('video')).toHaveLength(2); // desktop and mobile layouts
  expect(wrapper.find('video').attributes('src')).toBe(history[14].demoUrl);
  expect(wrapper.find('video').attributes()).toHaveProperty('controls');
  const button = wrapper.findAll('button').find(b => b.text() === 'Full build')!;
  await button.trigger('click');
  expect(wrapper.findAll('video')).toHaveLength(1); // mobile demo remains available
  expect(wrapper.findAll('a').find(a => a.text().includes('Watch the full build'))?.attributes('href')).toBe(history[14].recordingUrl);
  wrapper.unmount();
});
test('days without a demo retain their full-build view', () => {
  const wrapper = render(13);
  expect(wrapper.find('video').exists()).toBe(false);
  expect(wrapper.findAll('a').find(a => a.text().includes('Watch the full build'))?.attributes('href')).toBe(history[13].recordingUrl);
  wrapper.unmount();
});
