import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormInput } from '../components/form/FormInput';
import { FormSelect } from '../components/form/FormSelect';

describe('FormSelect', () => {
  it('renders label always docked at top-2 so it never collides with option values', () => {
    render(
      <FormSelect
        label="Maakond"
        name="county"
        options={[
          { value: '', label: 'Kõik maakonnad' },
          { value: 'harju', label: 'Harju maakond' },
        ]}
      />,
    );

    const label = screen.getByText('Maakond');
    expect(label).toHaveClass('top-2', 'text-label');
    expect(label).not.toHaveClass('top-4');
  });

  it('changes label color on focus and blur', () => {
    render(
      <FormSelect
        label="Vald"
        name="parish"
        options={[{ value: '', label: 'Kõik vallad' }]}
      />,
    );

    const select = screen.getByRole('combobox');
    const label = screen.getByText('Vald');

    expect(label).toHaveClass('text-ink-muted');

    fireEvent.focus(select);
    expect(label).toHaveClass('text-primary');

    fireEvent.blur(select);
    expect(label).toHaveClass('text-ink-muted');
  });

  it('renders disabled styling on select and label when disabled', () => {
    render(
      <FormSelect
        label="Vald"
        name="parish"
        disabled
        options={[{ value: '', label: 'Kõik vallad' }]}
      />,
    );

    const select = screen.getByRole('combobox');
    const label = screen.getByText('Vald');

    expect(select).toBeDisabled();
    expect(label).toHaveClass('opacity-60');
  });
});

describe('FormInput', () => {
  it('floats label to top-2 when placeholder is provided to prevent overlap', () => {
    render(
      <FormInput
        label="E-post"
        name="email"
        placeholder="sinu@email.ee"
      />,
    );

    const label = screen.getByText('E-post');
    const input = screen.getByPlaceholderText('sinu@email.ee');

    expect(label).toHaveClass('top-2', 'text-label');
    expect(label).not.toHaveClass('top-4');
    expect(input).toBeInTheDocument();
  });

  it('rests label at top-4 when empty and no placeholder, and floats on focus', () => {
    render(
      <FormInput
        label="Katastritunnus"
        name="cadastre"
      />,
    );

    const label = screen.getByText('Katastritunnus');
    const input = screen.getByRole('textbox');

    expect(label).toHaveClass('top-4', 'text-body');

    fireEvent.focus(input);
    expect(label).toHaveClass('top-2', 'text-label');

    fireEvent.blur(input);
    expect(label).toHaveClass('top-4', 'text-body');
  });

  it('floats label to top-2 when initial value or defaultValue is present', () => {
    render(
      <FormInput
        label="Nimi"
        name="name"
        defaultValue="Mati Maasikas"
      />,
    );

    const label = screen.getByText('Nimi');
    expect(label).toHaveClass('top-2', 'text-label');
  });
});

