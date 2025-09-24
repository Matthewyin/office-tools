# 机柜部署图生成工具 - 架构设计文档

## 1. 系统概述

机柜部署图生成工具是一个基于Python的自动化工具，用于将CSV格式的设备清单数据转换为draw.io格式的可视化机柜部署图。系统采用模块化设计，支持网格化机柜视图和多机房Sheet页展示。

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CSV 输入文件   │───▶│   数据处理层     │───▶│   布局计算层     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Draw.io 输出   │◀───│   图形生成层     │◀───│   配置管理层     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2.2 核心模块

#### 2.2.1 数据处理层 (csv_processor.py)
- **职责**: CSV文件解析、数据验证、格式转换
- **核心功能**:
  - 自动检测CSV格式（支持多种字段命名）
  - 数据类型验证和清洗
  - 设备对象模型转换
  - 错误报告和数据统计

#### 2.2.2 数据模型层 (models.py)
- **职责**: 定义核心数据结构
- **核心类**:
  - `Device`: 设备信息模型
  - `Cabinet`: 机柜信息模型
  - `Layout`: 布局信息模型

#### 2.2.3 布局计算层 (layout_engine.py)
- **职责**: 设备布局计算、冲突检测、位置优化
- **核心算法**:
  - U位冲突检测算法
  - 自动位置调整策略
  - 机房和机柜分组逻辑

#### 2.2.4 图形生成层 (drawio_generator.py)
- **职责**: Draw.io XML格式生成
- **核心功能**:
  - 网格化机柜视图生成
  - 多机房Sheet页创建
  - 精确U位对齐计算
  - XML结构构建

#### 2.2.5 配置管理层 (config.py)
- **职责**: 系统配置管理
- **配置项**:
  - 图形样式配置
  - 布局参数配置
  - 显示选项配置

#### 2.2.6 工具函数层 (utils.py)
- **职责**: 通用工具函数
- **功能**:
  - 文件操作工具
  - 日志管理
  - 路径处理

#### 2.2.7 主程序入口 (main.py)
- **职责**: 命令行接口、流程控制
- **命令**:
  - `generate`: 生成机柜部署图
  - `validate`: 验证CSV数据
  - `preview`: 预览布局信息

## 3. 数据流程

### 3.1 数据处理流程

```
CSV文件 → 格式检测 → 数据验证 → 对象转换 → 设备列表
   │         │         │         │         │
   │         │         │         │         ▼
   │         │         │         │    机柜分组
   │         │         │         │         │
   │         │         │         │         ▼
   │         │         │         │    机房分组
   │         │         │         │         │
   │         │         │         │         ▼
   │         │         │         │    布局对象
   │         │         │         │
   │         │         │         ▼
   │         │         │    错误报告
   │         │         │
   │         │         ▼
   │         │    验证结果
   │         │
   │         ▼
   │    格式信息
   │
   ▼
统计信息
```

### 3.2 布局计算流程

```
设备列表 → 机柜分组 → U位分配 → 冲突检测 → 位置调整 → 最终布局
   │         │         │         │         │         │
   │         │         │         │         │         ▼
   │         │         │         │         │    调整记录
   │         │         │         │         │
   │         │         │         │         ▼
   │         │         │         │    冲突解决
   │         │         │         │
   │         │         │         ▼
   │         │         │    冲突列表
   │         │         │
   │         │         ▼
   │         │    U位占用表
   │         │
   │         ▼
   │    机柜对象列表
   │
   ▼
布局统计
```

### 3.3 图形生成流程

```
布局对象 → 机房分组 → Sheet页创建 → 机柜绘制 → XML生成 → 文件输出
   │         │         │           │         │         │
   │         │         │           │         │         ▼
   │         │         │           │         │    Draw.io文件
   │         │         │           │         │
   │         │         │           │         ▼
   │         │         │           │    XML结构
   │         │         │           │
   │         │         │           ▼
   │         │         │      设备元素
   │         │         │
   │         │         ▼
   │         │    Sheet页元素
   │         │
   │         ▼
   │    机房Sheet页
   │
   ▼
多Sheet页结构
```

## 4. 关键算法

### 4.1 U位对齐算法

```python
# U位坐标计算
def calculate_u_position(cabinet_y, cabinet_height, u_number, u_height):
    """
    计算U位的Y坐标
    
    Args:
        cabinet_y: 机柜起始Y坐标
        cabinet_height: 机柜总高度
        u_number: U位编号 (1-42)
        u_height: 单个U位高度
    
    Returns:
        U位底部边界的Y坐标
    """
    return cabinet_y + cabinet_height - (u_number * u_height)

# 设备位置计算
def calculate_device_position(cabinet_y, cabinet_height, start_u, device_height, u_height):
    """
    计算设备的精确位置
    
    Args:
        cabinet_y: 机柜起始Y坐标
        cabinet_height: 机柜总高度
        start_u: 设备起始U位
        device_height: 设备高度(U数)
        u_height: 单个U位高度
    
    Returns:
        (device_y, device_height_px): 设备Y坐标和像素高度
    """
    end_u = start_u + device_height - 1
    device_top_y = cabinet_y + cabinet_height - ((end_u + 1) * u_height)
    device_height_px = device_height * u_height
    return device_top_y, device_height_px
```

### 4.2 冲突检测算法

```python
def detect_conflicts(devices_in_cabinet):
    """
    检测机柜内设备的U位冲突
    
    Args:
        devices_in_cabinet: 机柜内设备列表
    
    Returns:
        conflicts: 冲突设备对列表
    """
    conflicts = []
    for i, device1 in enumerate(devices_in_cabinet):
        for device2 in devices_in_cabinet[i+1:]:
            if u_ranges_overlap(device1, device2):
                conflicts.append((device1, device2))
    return conflicts

def u_ranges_overlap(device1, device2):
    """检查两个设备的U位范围是否重叠"""
    range1 = (device1.U位, device1.U位 + device1.设备高度 - 1)
    range2 = (device2.U位, device2.U位 + device2.设备高度 - 1)
    return not (range1[1] < range2[0] or range2[1] < range1[0])
```

### 4.3 网格生成算法

```python
def create_u_grid(cabinet_x, cabinet_y, cabinet_width, cabinet_height, u_height):
    """
    生成U位网格
    
    Args:
        cabinet_x, cabinet_y: 机柜位置
        cabinet_width, cabinet_height: 机柜尺寸
        u_height: U位高度
    
    Returns:
        grid_elements: 网格XML元素列表
    """
    grid_elements = []
    for u in range(1, 43):  # U1到U42
        u_bottom_y = cabinet_y + cabinet_height - (u * u_height)
        u_top_y = u_bottom_y - u_height
        
        grid_element = create_grid_cell(
            x=cabinet_x,
            y=u_top_y,
            width=cabinet_width,
            height=u_height
        )
        grid_elements.append(grid_element)
    
    return grid_elements
```

## 5. 扩展性设计

### 5.1 配置扩展
- 支持自定义颜色主题
- 支持自定义机柜尺寸
- 支持自定义字体和样式

### 5.2 格式扩展
- 支持更多输入格式（Excel、JSON等）
- 支持更多输出格式（SVG、PNG等）

### 5.3 功能扩展
- 支持设备连线图
- 支持3D机柜视图
- 支持设备状态显示

### 5.4 集成扩展
- 支持API接口
- 支持Web界面
- 支持数据库集成

## 6. 性能考虑

### 6.1 内存优化
- 流式处理大型CSV文件
- 延迟加载图形元素
- 及时释放临时对象

### 6.2 计算优化
- 缓存重复计算结果
- 并行处理独立任务
- 优化算法复杂度

### 6.3 文件优化
- 压缩输出XML文件
- 批量文件操作
- 增量更新机制

## 7. 错误处理

### 7.1 数据错误
- CSV格式错误处理
- 数据类型错误处理
- 缺失字段错误处理

### 7.2 布局错误
- U位冲突自动解决
- 超出机柜范围处理
- 无效配置处理

### 7.3 系统错误
- 文件权限错误处理
- 内存不足错误处理
- 网络错误处理

## 8. 测试策略

### 8.1 单元测试
- 各模块功能测试
- 边界条件测试
- 异常情况测试

### 8.2 集成测试
- 端到端流程测试
- 多机房场景测试
- 大数据量测试

### 8.3 性能测试
- 处理速度测试
- 内存使用测试
- 并发处理测试
