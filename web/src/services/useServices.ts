import { useContext } from 'react';

import ServicesContext from './ServicesContext';
import Services from './Services';


const useServices = (): Services => {
  return useContext(ServicesContext) as Services;
};

export default useServices;
