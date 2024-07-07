import React from 'react';

import Services from './Services';
import useServices from './useServices';

/**
 * A HOC to inject the services. Note that:
 *   1) refs will NOT be forwarded
 *   2) static properties and methods will NOT be attached to the
 *      returned component
 * If you're curious as to why refs are not forwarded, checkout these threads:
 * https://gist.github.com/OliverJAsh/d2f462b03b3e6c24f5588ca7915d010e
 * https://github.com/DefinitelyTyped/DefinitelyTyped/issues/35834#issuecomment-497445051
 *
 * Static properties are not attached to the returned component, because that
 * is the behavior most HOC's have, and consistency is important.
 *
 */
export interface WithServicesProps {
  services: Services;
}

const withServices = <P extends WithServicesProps>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<Omit<P, keyof WithServicesProps>> => {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithServicesProps: React.ComponentType<Omit<
    P,
    keyof WithServicesProps
  >> = (props) => {
    const services = useServices();
    const allProps = { ...props, services } as P;
    return <WrappedComponent {...allProps} />;
  };
  ComponentWithServicesProps.displayName = `WithServicesProps(${displayName})`;

  return ComponentWithServicesProps;
};

export default withServices;
