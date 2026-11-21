import React from 'react';
import renderer from 'react-test-renderer';
import { CareNestLogo, CareNestLogoMark } from '../src/components/CareNestLogo';

describe('CareNestLogo and CareNestLogoMark', () => {
  it('renders CareNestLogoMark with default solid props', () => {
    const tree = renderer.create(<CareNestLogoMark size={48} />).toJSON();
    expect(tree).toBeDefined();
  });

  it('renders CareNestLogoMark bare variant', () => {
    const tree = renderer.create(<CareNestLogoMark size={32} variant="bare" />).toJSON();
    expect(tree).toBeDefined();
  });

  it('renders CareNestLogo with full lockup (vertical with tagline and role badge)', () => {
    const tree = renderer
      .create(
        <CareNestLogo
          size={56}
          layout="vertical"
          showTagline
          showRoleBadge
          roleText="CỔNG ĐIỀU DƯỠNG VIÊN"
        />
      )
      .toJSON();
    expect(tree).toBeDefined();
  });

  it('renders CareNestLogo horizontal layout', () => {
    const tree = renderer
      .create(
        <CareNestLogo
          size={36}
          layout="horizontal"
          brandName="CareNest"
        />
      )
      .toJSON();
    expect(tree).toBeDefined();
  });
});
