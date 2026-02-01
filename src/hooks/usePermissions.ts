import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

export const usePermissions = () => {
  const authState = useSelector((state: RootState) => state.auth);
  
  console.log('🔐 Full Auth State:', authState);

  const getPermissions = () => {
    // Get from Redux auth state first
    let permissions = authState.permissions;
    
    console.log('📋 Permissions from Auth:', permissions);
    
    // If empty, check localStorage as fallback
    if (!permissions || Object.keys(permissions).length === 0) {
      try {
        const storedPermissions = localStorage.getItem('userPermissions');
        if (storedPermissions) {
          console.log('💾 Using localStorage permissions');
          return JSON.parse(storedPermissions);
        }
      } catch (error) {
        console.error('Error parsing localStorage permissions:', error);
      }
    }
    
    // Return whatever we have (could be empty)
    return permissions || {};
  };

  const permissions = getPermissions();

  const hasPermission = (app: string, module: string, action: string): boolean => {
    try {
      console.log('🔍 Checking Permission:', { app, module, action });
      
      if (!permissions || Object.keys(permissions).length === 0) {
        console.log('❌ No permissions found');
        return false;
      }
      
      const appPerms = permissions[app] || {};
      const modulePerms = appPerms[module] || {};
      
      const hasPerm = modulePerms[action] === true || modulePerms[action] === 1;
      console.log('✅ Permission Result:', hasPerm);
      return hasPerm;
    } catch (error) {
      console.error('❌ Permission check error:', error);
      return false;
    }
  };

  const isModuleVisible = (app: string, module: string): boolean => {
    try {
      if (!permissions || Object.keys(permissions).length === 0) return false;
      
      const appPerms = permissions[app] || {};
      const modulePerms = appPerms[module] || {};
      
      const isVisible = !modulePerms.hide && 
                       (modulePerms.read === true || modulePerms.read === 1);
      
      return isVisible;
    } catch (error) {
      console.error('❌ Module visibility check error:', error);
      return false;
    }
  };

  return {
    hasPermission,
    isModuleVisible,
    permissions
  };
};

