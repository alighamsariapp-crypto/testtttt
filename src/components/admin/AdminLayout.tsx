// Style: The active admin route renders the approved NovinNet staging workspace verbatim; the real auth guard stays outside it while legacy UI remains in git history for rollback.
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api, isDemoMode } from '../../services/api';
import { AdminAuthGuard } from './AdminAuthGuard';
import { StagingAdminReplica } from './staging/StagingAdminReplica';
// Design: the admin replica remains a compact operational surface; demo product mutations share only the storefront catalogue state.
import { createLiveAdminData, mapLiveProduct, toCategoryWritePayload, toProductWritePayload, type AdminCategoryAttributeDraft, type AdminDashboardResponse, type AdminProductAttributeDefinition, type AdminReplicaProduct } from './staging/adminLiveData';

const mapProductAttributeDefinition = (definition: Record<string, any>): AdminProductAttributeDefinition => {
  const categories = Array.isArray(definition.categories) ? definition.categories.filter((category: unknown): category is Record<string, any> => Boolean(category && typeof category === 'object')) : [];
  const categoryConfigs = categories.reduce<NonNullable<AdminProductAttributeDefinition['categoryConfigs']>>((configs, category) => {
    const id = Number(category.id);
    const pivot = category.pivot && typeof category.pivot === 'object' ? category.pivot as Record<string, unknown> : {};
    if (!Number.isFinite(id) || id <= 0) return configs;
    configs[id] = {
      isFilterable: pivot.is_filterable !== false,
      isRequired: Boolean(pivot.is_required),
      inheritToChildren: pivot.inherit_to_children !== false,
      sortOrder: Number(pivot.sort_order ?? definition.sort_order ?? 100),
    };
    return configs;
  }, {});
  return {
    id: Number(definition.id),
    key: String(definition.key || ''),
    name: String(definition.name || definition.key || 'ویژگی کالا'),
    dataType: String(definition.data_type || 'single_select'),
    unit: typeof definition.unit === 'string' ? definition.unit : undefined,
    options: Array.isArray(definition.options) ? definition.options.map(String) : [],
    categoryIds: categories.map((category) => Number(category.id)).filter(Boolean),
    isRequired: Boolean(definition.is_required),
    isFilterable: definition.is_filterable !== false,
    isActive: definition.is_active !== false,
    sortOrder: Number(definition.sort_order ?? 100),
    categoryConfigs,
  };
};

const AdminWorkspace: React.FC = () => {
  const { user, allOrders, allUsers, products, categories, supportTickets, appearanceSettings, updateAppearanceSettings, staticContent, updateStaticContent, blogPosts, addBlogPost, updateBlogPost, deleteBlogPost, checkoutConfiguration, updateCheckoutConfiguration, smsSystemConfiguration, updateSmsSystemConfiguration, testSmsSystemConnection, addProduct, updateProduct, deleteProduct, toggleProductActive, toggleProductFeatured, addCategory, updateCategory, deleteCategory, updateOrderStatus, updateUserRole, adjustUserWallet, adminReplyTicket, updateTicketStatus, markAdminTicketRead, archiveAdminTicket, restoreAdminTicket, deleteAdminTicket } = useApp();
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(false);
  const [productAttributeDefinitions, setProductAttributeDefinitions] = useState<AdminProductAttributeDefinition[]>([]);
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return null;
  }
  const adminUser = user;
  const isLiveAdmin = !isDemoMode;

  useEffect(() => {
    if (!isLiveAdmin) return;
    let active = true;
    setDashboardLoading(true);
    setDashboardError(false);

    void api.adminRequest<AdminDashboardResponse>('/dashboard')
      .then((response) => {
        if (active) setDashboard(response);
      })
      .catch(() => {
        if (active) setDashboardError(true);
      })
      .finally(() => {
        if (active) setDashboardLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isLiveAdmin]);

  useEffect(() => {
    if (!isLiveAdmin) {
      setProductAttributeDefinitions([]);
      return;
    }
    let active = true;
    void api.getAdminProductAttributeDefinitions()
      .then((definitions) => {
        if (!active) return;
        setProductAttributeDefinitions(definitions.map(mapProductAttributeDefinition).filter((definition) => definition.key));
      })
      .catch(() => {
        if (active) setProductAttributeDefinitions([]);
      });
    return () => { active = false; };
  }, [isLiveAdmin]);

  const operations = useMemo(() => ({
    saveProduct: async (product: Parameters<NonNullable<ReturnType<typeof createLiveAdminData>['operations']>['saveProduct']>[0], mode: 'create' | 'update') => {
      const payload = toProductWritePayload(product, categories);
      if (mode === 'create') {
        await addProduct(payload);
        return;
      }
      await updateProduct(product.id, payload);
    },
    deleteProduct,
    toggleProductActive,
    toggleProductFeatured,
    saveCategory: (category: Parameters<NonNullable<ReturnType<typeof createLiveAdminData>['operations']>['saveCategory']>[0], mode: 'create' | 'update') => {
      const payload = toCategoryWritePayload(category);
      if (mode === 'create') addCategory(payload);
      else updateCategory(category.id, payload);
    },
    deleteCategory,
    toggleCategoryActive: (id: number, active: boolean) => updateCategory(id, { is_active: active }),
    saveCategoryProductAttributes: async (categoryId: number, drafts: AdminCategoryAttributeDraft[]) => {
      const attached = [] as Array<{ id: number; is_filterable: boolean; is_required: boolean; inherit_to_children: boolean; sort_order: number }>;
      for (const draft of drafts) {
        const payload = {
          key: draft.key,
          name: draft.name,
          data_type: draft.dataType,
          unit: draft.unit || undefined,
          options: draft.options,
          is_filterable: draft.isFilterable,
          is_required: draft.isRequired,
          is_active: true,
          sort_order: draft.sortOrder,
        };
        const saved = draft.id
          ? await api.updateAdminProductAttributeDefinition(draft.id, payload)
          : await api.createAdminProductAttributeDefinition(payload);
        attached.push({
          id: Number(saved.id),
          is_filterable: draft.isFilterable,
          is_required: draft.isRequired,
          inherit_to_children: draft.inheritToChildren,
          sort_order: draft.sortOrder,
        });
      }
      await api.syncAdminCategoryProductAttributes(categoryId, attached);
      const definitions = await api.getAdminProductAttributeDefinitions();
      setProductAttributeDefinitions(definitions.map(mapProductAttributeDefinition).filter((definition) => definition.key));
    },
    saveOrder: (order) => {
      const statuses = {
        'نیازمند تایید': 'pending',
        'آماده‌سازی': 'preparing',
        'ارسال شده': 'shipping',
        'تحویل شده': 'delivered',
        'لغو شده': 'cancelled',
      } as const;
      updateOrderStatus(String(order.id), statuses[order.status], order.tracking || undefined);
    },
    replyTicket: (ticketId: string, message: string) => adminReplyTicket(ticketId, message),
    updateTicketStatus: (ticketId: string, status) => updateTicketStatus(ticketId, status),
    markTicketRead: (ticketId: string) => markAdminTicketRead(ticketId),
    archiveTicket: (ticketId: string) => archiveAdminTicket(ticketId),
    restoreTicket: (ticketId: string) => restoreAdminTicket(ticketId),
    deleteTicket: (ticketId: string) => deleteAdminTicket(ticketId),
    saveUser: async (customer: Parameters<NonNullable<ReturnType<typeof createLiveAdminData>['operations']>['saveUser']>[0]) => {
      const current = allUsers.find((user) => user.id === customer.id);
      if (!current) throw new Error('اطلاعات مشتری برای ذخیره‌سازی پیدا نشد.');
      const roleMap = { 'مدیر ارشد': 'admin', 'کارشناس': 'staff', 'مشتری': 'customer' } as const;
      const nextRole = roleMap[customer.role];
      const nextStatus = customer.active ? 'active' : 'suspended';
      if (nextRole !== current.role || nextStatus !== current.status) {
        await updateUserRole(customer.id, nextRole, nextStatus);
      }
      const currentWalletToman = Math.round((current.wallet_balance ?? 0) / 10);
      const walletAdjustmentIrr = Math.round((customer.wallet - currentWalletToman) * 10);
      if (walletAdjustmentIrr !== 0) {
        await adjustUserWallet(customer.id, walletAdjustmentIrr, 'اصلاح دستی اعتبار کیف پول از پنل مدیریت');
      }
    },
  }), [addCategory, addProduct, adjustUserWallet, adminReplyTicket, allUsers, archiveAdminTicket, categories, deleteAdminTicket, deleteCategory, deleteProduct, markAdminTicketRead, restoreAdminTicket, toggleProductActive, toggleProductFeatured, updateCategory, updateOrderStatus, updateProduct, updateTicketStatus, updateUserRole]);

  const demoProductOperations = useMemo(() => ({
    saveProduct: async (product: AdminReplicaProduct, mode: 'create' | 'update') => {
      const payload = toProductWritePayload(product, categories);
      const saved = mode === 'create'
        ? await addProduct(payload)
        : await updateProduct(product.id, payload);
      return mapLiveProduct(saved, categories);
    },
    deleteProduct,
    toggleProductActive,
    toggleProductFeatured,
  }), [addProduct, categories, deleteProduct, toggleProductActive, toggleProductFeatured, updateProduct]);

  const demoProducts = useMemo(() => {
    return products.map((product) => mapLiveProduct(product, categories));
  }, [categories, products]);

  const liveData = useMemo(() => {
    return createLiveAdminData({
      user: adminUser,
      orders: allOrders,
      products,
      categories,
      tickets: supportTickets,
      users: allUsers,
      dashboard,
      dashboardLoading,
      dashboardError,
      productAttributeDefinitions,
      operations,
    });
  }, [adminUser, allOrders, allUsers, categories, dashboard, dashboardError, dashboardLoading, operations, productAttributeDefinitions, products, supportTickets]);

  return <StagingAdminReplica liveData={liveData} demoProducts={demoProducts} demoProductOperations={demoProductOperations} contentManagement={{ value: staticContent, save: async (section, value) => updateStaticContent(section, value) }} homepageManagement={{ value: appearanceSettings, save: updateAppearanceSettings }} blogManagement={{ posts: blogPosts, create: addBlogPost, update: updateBlogPost, remove: deleteBlogPost }} checkoutManagement={{ value: checkoutConfiguration, save: updateCheckoutConfiguration }} smsManagement={{ value: smsSystemConfiguration, save: updateSmsSystemConfiguration, testConnection: testSmsSystemConnection }} />;
};

export const AdminLayout: React.FC = () => {
  useEffect(() => {
    const root = document.documentElement;
    const hadDarkTheme = root.classList.contains('dark');
    root.classList.remove('dark');

    return () => {
      if (hadDarkTheme) root.classList.add('dark');
    };
  }, []);

  return (
    <AdminAuthGuard>
      <div className="staging-admin-replica" dir="rtl">
        <AdminWorkspace />
      </div>
    </AdminAuthGuard>
  );
};
