import React from 'react';
import styles from './overview-page.scss';
import { PedestrianFamily } from '@carbon/react/icons';

const OverviewIllustration: React.FC = () => {
  return (
    <div className={styles.svgContainer}>
      <PedestrianFamily className={styles.iconOveriders} />
    </div>
  );
};

export default OverviewIllustration;
