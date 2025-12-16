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
        Shinzō is a trustless data read layer for blockchains that allows apps to read data directly from the network, without relying on centralized indexers or APIs. Validators and a peer network of Hosts provide provable, verifiable data, enabling developers to build on chain data without trusting a middleman.
      </>
    ),
  },
  {
    title: 'How does it work?',
    Svg: require('@site/static/img/shinzo-logo.svg').default,
    description: (
      <>
        Validators create application-ready views from consensus events with cryptographic proofs. Hosts replicate and serve this data over a decentralized network, while apps access it through APIs or streams, transforming raw events into balances, histories, and cross-chain views, all fully verifiable.      </>
    ),
  },
  {
    title: 'Why Shinzō?',
    Svg: require('@site/static/img/shinzo-logo.svg').default,
    description: (
      <>
        Shinzō gives blockchain data the same guarantees as the base layer. Every answer is cryptographically verifiable, no single vendor controls access, and reading the chain is open and permissionless. Shinzō lets developers build on blockchain truth rather than assumptions: reading the chain as it is, not as someone tells you it is.
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
