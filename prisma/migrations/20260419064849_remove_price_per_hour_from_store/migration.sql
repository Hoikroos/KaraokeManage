BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Products] (
    [Id] VARCHAR(50) NOT NULL,
    [StoreId] VARCHAR(50) NOT NULL,
    [Name] NVARCHAR(100) NOT NULL,
    [Category] VARCHAR(20) NOT NULL,
    [Price] DECIMAL(10,2) NOT NULL,
    [Quantity] INT NOT NULL CONSTRAINT [Products_Quantity_df] DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Products_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Products_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Store] (
    [Id] VARCHAR(50) NOT NULL,
    [Name] NVARCHAR(150) NOT NULL,
    [Address] NVARCHAR(255) NOT NULL,
    [Phone] VARCHAR(20) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Store_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Store_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Room] (
    [Id] VARCHAR(50) NOT NULL,
    [StoreId] VARCHAR(50) NOT NULL,
    [RoomNumber] VARCHAR(20) NOT NULL,
    [Capacity] INT NOT NULL,
    [Status] VARCHAR(20) NOT NULL CONSTRAINT [Room_Status_df] DEFAULT 'empty',
    [PricePerHour] DECIMAL(10,2) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Room_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Room_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[RoomSessions] (
    [Id] VARCHAR(50) NOT NULL,
    [RoomId] VARCHAR(50) NOT NULL,
    [StoreId] VARCHAR(50) NOT NULL,
    [StartTime] DATETIME2 NOT NULL,
    [EndTime] DATETIME2,
    [Status] VARCHAR(20) NOT NULL CONSTRAINT [RoomSessions_Status_df] DEFAULT 'active',
    [CustomerName] NVARCHAR(150) CONSTRAINT [RoomSessions_CustomerName_df] DEFAULT 'Khách lẻ',
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [RoomSessions_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RoomSessions_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[OrderItems] (
    [Id] VARCHAR(50) NOT NULL,
    [RoomSessionId] VARCHAR(50) NOT NULL,
    [ProductId] VARCHAR(50) NOT NULL,
    [ProductName] NVARCHAR(100) NOT NULL,
    [Price] DECIMAL(10,2) NOT NULL,
    [Quantity] INT NOT NULL,
    [OrderedAt] DATETIME2 NOT NULL CONSTRAINT [OrderItems_OrderedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [OrderItems_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [OrderItems_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryLogs] (
    [Id] VARCHAR(50) NOT NULL,
    [ProductId] VARCHAR(50) NOT NULL,
    [StoreId] VARCHAR(50) NOT NULL,
    [Quantity] INT NOT NULL,
    [Type] VARCHAR(20) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [InventoryLogs_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InventoryLogs_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Users] (
    [Id] VARCHAR(50) NOT NULL,
    [Email] VARCHAR(100) NOT NULL,
    [Password] VARCHAR(255) NOT NULL,
    [Name] NVARCHAR(100) NOT NULL,
    [Role] VARCHAR(20) NOT NULL CONSTRAINT [Users_Role_df] DEFAULT 'user',
    [StoreId] VARCHAR(50),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Users_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Users_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [Users_Email_key] UNIQUE NONCLUSTERED ([Email])
);

-- CreateTable
CREATE TABLE [dbo].[Invoices] (
    [Id] VARCHAR(50) NOT NULL,
    [RoomSessionId] VARCHAR(50) NOT NULL,
    [StoreId] VARCHAR(50) NOT NULL,
    [RoomId] VARCHAR(50) NOT NULL,
    [StartTime] DATETIME2 NOT NULL,
    [EndTime] DATETIME2 NOT NULL,
    [RoomCost] DECIMAL(10,2) NOT NULL,
    [TotalPrice] DECIMAL(10,2) NOT NULL,
    [Status] VARCHAR(20) NOT NULL CONSTRAINT [Invoices_Status_df] DEFAULT 'pending',
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Invoices_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [CustomerName] NVARCHAR(100) CONSTRAINT [Invoices_CustomerName_df] DEFAULT 'Khách l?',
    CONSTRAINT [Invoices_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [Invoices_RoomSessionId_key] UNIQUE NONCLUSTERED ([RoomSessionId])
);

-- AddForeignKey
ALTER TABLE [dbo].[Products] ADD CONSTRAINT [Products_StoreId_fkey] FOREIGN KEY ([StoreId]) REFERENCES [dbo].[Store]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Room] ADD CONSTRAINT [Room_StoreId_fkey] FOREIGN KEY ([StoreId]) REFERENCES [dbo].[Store]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RoomSessions] ADD CONSTRAINT [RoomSessions_RoomId_fkey] FOREIGN KEY ([RoomId]) REFERENCES [dbo].[Room]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItems] ADD CONSTRAINT [OrderItems_ProductId_fkey] FOREIGN KEY ([ProductId]) REFERENCES [dbo].[Products]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItems] ADD CONSTRAINT [OrderItems_RoomSessionId_fkey] FOREIGN KEY ([RoomSessionId]) REFERENCES [dbo].[RoomSessions]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryLogs] ADD CONSTRAINT [InventoryLogs_ProductId_fkey] FOREIGN KEY ([ProductId]) REFERENCES [dbo].[Products]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryLogs] ADD CONSTRAINT [InventoryLogs_StoreId_fkey] FOREIGN KEY ([StoreId]) REFERENCES [dbo].[Store]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Users] ADD CONSTRAINT [Users_StoreId_fkey] FOREIGN KEY ([StoreId]) REFERENCES [dbo].[Store]([Id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Invoices] ADD CONSTRAINT [Invoices_RoomSessionId_fkey] FOREIGN KEY ([RoomSessionId]) REFERENCES [dbo].[RoomSessions]([Id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
