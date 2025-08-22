-- RBAC System Implementation for ECOSYSTEM Marketplace Platform
-- Phase 1: Database Architecture & RBAC Foundation

-- 1. Create user roles enum
CREATE TYPE user_role AS ENUM ('customer', 'provider', 'admin', 'support', 'moderator');

-- 2. Create user_roles table for role assignments
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role user_role NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by TEXT REFERENCES profiles(user_id),
  expires_at TIMESTAMP,
  UNIQUE(user_id, role)
);

-- 3. Add active_role to profiles for role switching
ALTER TABLE profiles 
ADD COLUMN active_role user_role DEFAULT 'customer',
ADD COLUMN is_dual_role BOOLEAN DEFAULT false;

-- 4. Create role_permissions table
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  resource TEXT NOT NULL, -- e.g., 'bookings', 'providers', 'reviews'
  action TEXT NOT NULL,   -- e.g., 'create', 'read', 'update', 'delete'
  conditions JSONB,       -- Optional conditions for permission
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, resource, action)
);

-- 5. Create role_switch_logs for audit trail
CREATE TABLE role_switch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  previous_role user_role,
  new_role user_role NOT NULL,
  switched_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- 6. Create service_categories table
CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  default_commission_rate NUMERIC(3,2) DEFAULT 0.12, -- 12% default
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Create commission_rules table
CREATE TABLE commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES service_categories(id) ON DELETE CASCADE,
  provider_tier TEXT, -- 'standard', 'premium', 'vip'
  min_booking_amount NUMERIC(10,2),
  max_booking_amount NUMERIC(10,2),
  commission_rate NUMERIC(3,2) NOT NULL, -- e.g., 0.15 for 15%
  effective_from TIMESTAMP DEFAULT NOW(),
  effective_to TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Create payment_models table
CREATE TABLE payment_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  model_type TEXT NOT NULL CHECK (model_type IN (
    'one_time', 'hourly_rate', 'fixed_price', 
    'recurring_subscription', 'package_bundle', 
    'milestone_based', 'deposit_remainder'
  )),
  configuration JSONB, -- Model-specific configuration
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Insert default roles and permissions
INSERT INTO role_permissions (role, resource, action) VALUES
-- Customer permissions
('customer', 'bookings', 'create'),
('customer', 'bookings', 'read'),
('customer', 'bookings', 'update'),
('customer', 'reviews', 'create'),
('customer', 'reviews', 'read'),
('customer', 'providers', 'read'),
('customer', 'profiles', 'read'),
('customer', 'profiles', 'update'),

-- Provider permissions
('provider', 'providers', 'create'),
('provider', 'providers', 'read'),
('provider', 'providers', 'update'),
('provider', 'bookings', 'read'),
('provider', 'bookings', 'update'),
('provider', 'reviews', 'read'),
('provider', 'reviews', 'update'), -- For responding to reviews
('provider', 'provider_availability', 'create'),
('provider', 'provider_availability', 'read'),
('provider', 'provider_availability', 'update'),
('provider', 'provider_availability', 'delete'),

-- Admin permissions (full access)
('admin', 'bookings', 'create'),
('admin', 'bookings', 'read'),
('admin', 'bookings', 'update'),
('admin', 'bookings', 'delete'),
('admin', 'providers', 'create'),
('admin', 'providers', 'read'),
('admin', 'providers', 'update'),
('admin', 'providers', 'delete'),
('admin', 'reviews', 'create'),
('admin', 'reviews', 'read'),
('admin', 'reviews', 'update'),
('admin', 'reviews', 'delete'),
('admin', 'profiles', 'create'),
('admin', 'profiles', 'read'),
('admin', 'profiles', 'update'),
('admin', 'profiles', 'delete'),
('admin', 'user_roles', 'create'),
('admin', 'user_roles', 'read'),
('admin', 'user_roles', 'update'),
('admin', 'user_roles', 'delete'),

-- Support permissions
('support', 'bookings', 'read'),
('support', 'bookings', 'update'),
('support', 'providers', 'read'),
('support', 'reviews', 'read'),
('support', 'reviews', 'update'), -- For moderation
('support', 'profiles', 'read'),

-- Moderator permissions
('moderator', 'reviews', 'read'),
('moderator', 'reviews', 'update'),
('moderator', 'reviews', 'delete'),
('moderator', 'providers', 'read'),
('moderator', 'providers', 'update'); -- For verification

-- 10. Insert default service categories
INSERT INTO service_categories (slug, name, description, default_commission_rate) VALUES
('beauty', 'Beauty & Personal Care', 'Hair, makeup, nails, and personal grooming services', 0.15),
('pool', 'Pool & Maintenance', 'Pool cleaning, maintenance, and repair services', 0.12),
('home', 'Home Services', 'General home maintenance, repairs, and improvements', 0.10),
('lawn', 'Lawn & Garden', 'Landscaping, lawn care, and garden maintenance', 0.12),
('cleaning', 'Cleaning Services', 'House cleaning, deep cleaning, and organization', 0.13),
('pet', 'Pet Services', 'Pet grooming, walking, and sitting services', 0.14);

-- 11. Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_switch_logs_user_id ON role_switch_logs(user_id);
CREATE INDEX idx_commission_rules_category ON commission_rules(category_id);

-- 12. Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_switch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_models ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS Policies

-- User roles policies
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Admins can manage all roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid()::text 
      AND ur.role = 'admin'
    )
  );

-- Role permissions policies (read-only for all authenticated)
CREATE POLICY "All authenticated users can view permissions" ON role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Role switch logs policies
CREATE POLICY "Users can view their own switch logs" ON role_switch_logs
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Admins can view all switch logs" ON role_switch_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid()::text 
      AND ur.role = 'admin'
    )
  );

-- Service categories policies (public read)
CREATE POLICY "Everyone can view active categories" ON service_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON service_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid()::text 
      AND ur.role = 'admin'
    )
  );

-- Commission rules policies
CREATE POLICY "Providers can view commission rules" ON commission_rules
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid()::text 
        AND ur.role IN ('provider', 'admin')
      )
    )
  );

-- Payment models policies (public read)
CREATE POLICY "Everyone can view active payment models" ON payment_models
  FOR SELECT USING (is_active = true);

-- 14. Create helper functions

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id TEXT,
  p_resource TEXT,
  p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN := false;
  v_user_role user_role;
BEGIN
  -- Get user's active role
  SELECT active_role INTO v_user_role
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Check if role has permission
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions
    WHERE role = v_user_role
    AND resource = p_resource
    AND action = p_action
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to switch user role
CREATE OR REPLACE FUNCTION switch_user_role(
  p_user_id TEXT,
  p_new_role user_role
) RETURNS BOOLEAN AS $$
DECLARE
  v_previous_role user_role;
  v_has_role BOOLEAN;
BEGIN
  -- Check if user has the role
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = p_user_id
    AND role = p_new_role
  ) INTO v_has_role;
  
  IF NOT v_has_role THEN
    RETURN false;
  END IF;
  
  -- Get current role
  SELECT active_role INTO v_previous_role
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Update active role
  UPDATE profiles
  SET active_role = p_new_role
  WHERE user_id = p_user_id;
  
  -- Log the switch
  INSERT INTO role_switch_logs (user_id, previous_role, new_role)
  VALUES (p_user_id, v_previous_role, p_new_role);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign role to user
CREATE OR REPLACE FUNCTION assign_user_role(
  p_user_id TEXT,
  p_role user_role,
  p_assigned_by TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Insert or update role assignment
  INSERT INTO user_roles (user_id, role, assigned_by)
  VALUES (p_user_id, p_role, p_assigned_by)
  ON CONFLICT (user_id, role) 
  DO UPDATE SET assigned_at = NOW(), assigned_by = EXCLUDED.assigned_by;
  
  -- Update dual role flag if user has multiple roles
  UPDATE profiles
  SET is_dual_role = (
    SELECT COUNT(DISTINCT role) > 1
    FROM user_roles
    WHERE user_id = p_user_id
  )
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_categories_updated_at 
  BEFORE UPDATE ON service_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
