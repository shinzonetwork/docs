import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'What is Shinzō?',
    Svg: require('@site/static/img/shinzo-logo.svg').default,
    description: (
      <>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      </>
    ),
  },
  {
    title: 'How does it work?',
    Svg: require('@site/static/img/shinzo-logo.svg').default,
    description: (
      <>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      </>
    ),
  },
  {
    title: 'Why Shinzō?',
    Svg: require('@site/static/img/shinzo-logo.svg').default,
    description: (
      <>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      </>
    ),
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4', styles.feature)}>
      <div className="">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={clsx(styles.features, 'relative')}>
      <div className='container'>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx}  {...props} />
          ))}
        </div>
      </div>
      <div className="b-br" />
      <div className="b-bl" style={{ bottom: '10px' }} />
    </section>
  );
}
