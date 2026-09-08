import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LoginView from '../src/components/LoginView';

describe('LoginView', () => {
  it('shows the guest entry point and invokes it once', async () => {
    const user = userEvent.setup();
    const onGuestLogin = vi.fn().mockResolvedValue(true);
    render(
      <LoginView
        onLogin={vi.fn()}
        onGuestLogin={onGuestLogin}
        glassClass=""
        toggleTheme={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ゲストモードで見る' }));
    expect(onGuestLogin).toHaveBeenCalledTimes(1);
  });
});
