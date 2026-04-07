// import React, { createContext, useState, ReactNode } from 'react';

// interface LocationContextProps {
//   locations: string[];
//   setLocations: React.Dispatch<React.SetStateAction<string[]>>;
// }

// export const LocationContext = createContext<LocationContextProps | undefined>(undefined);

// interface LocationProviderProps {
//   children: ReactNode;
// }

// export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
//   const [locations, setLocations] = useState<string[]>([]);

//   return (
//     <LocationContext.Provider value={{ locations, setLocations }}>
//       {children}
//     </LocationContext.Provider>
//   );
// };
