import React, {isValidElement, type ReactNode} from 'react';
import useIsBrowser from '@docusaurus/useIsBrowser';
import ElementContent from '@theme/CodeBlock/Content/Element';
import StringContent from '@theme/CodeBlock/Content/String';
import type {Props} from '@theme/CodeBlock';

/**
 * Best attempt to make the children a plain string so it is copyable. If there
 * are react elements, we will not be able to copy the content, and it will
 * return `children` as-is; otherwise, it concatenates the string children
 * together.
 */
function maybeStringifyChildren(children: ReactNode): ReactNode {
  if (React.Children.toArray(children).some((el) => isValidElement(el))) {
    return children;
  }
  return Array.isArray(children) ? children.join('') : (children as string);
}

function isOutputLanguage(props: Omit<Props, 'children'>): boolean {
  if (props.language === 'output') return true;
  if (
    typeof props.className === 'string' &&
    props.className.includes('language-output')
  )
    return true;
  return false;
}

export default function CodeBlock({
  children: rawChildren,
  ...props
}: Props): ReactNode {
  const isBrowser = useIsBrowser();
  const children = maybeStringifyChildren(rawChildren);
  const CodeBlockComp =
    typeof children === 'string' ? StringContent : ElementContent;

  const isOutput = isOutputLanguage(props);

  if (isOutput) {
    return (
      <div className="theme-code-block--output">
        <span className="theme-code-block--output-label">output</span>
        <CodeBlockComp key={String(isBrowser)} {...props}>
          {children as string}
        </CodeBlockComp>
      </div>
    );
  }

  return (
    <CodeBlockComp key={String(isBrowser)} {...props}>
      {children as string}
    </CodeBlockComp>
  );
}
