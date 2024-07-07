import React from 'react';

import ServicesContext from './ServicesContext';
import Services from './Services';


export interface ServicesProviderProps {
  services: Services;
  children: React.ReactNode;
}

const ServicesProvider = (serviceProviderProps) => {
  return (
    <ServicesContext.Provider value={serviceProviderProps.services}>
      {serviceProviderProps.children}
    </ServicesContext.Provider>
  );
}

export default ServicesProvider;
