#!/usr/bin/env python3
"""测试边标签的表格显示功能"""

import tempfile
from pathlib import Path

from topotab.models import Endpoint, Link
from topotab.drawio_io import DrawioDocument


def test_edge_separated_multiline_labels():
    """测试边标签使用分离的文本框显示，字段分行显示，源端靠近源节点，目标端靠近目标节点"""
    
    # 创建测试链路
    src_endpoint = Endpoint(
        device_name="Router-A",
        management_address="10.0.0.1",
        port_channel="1",
        physical_interface="Eth1/1",
        vrf="VRF-MAIN",
        vlan="100",
        interface_ip="192.168.1.1/30"
    )
    
    dst_endpoint = Endpoint(
        device_name="Router-B", 
        management_address="10.0.0.2",
        port_channel="2",
        physical_interface="Eth1/2",
        vrf="VRF-MAIN",
        vlan="200",
        interface_ip="192.168.1.2/30"
    )
    
    link = Link(
        sequence="1",
        src=src_endpoint,
        dst=dst_endpoint,
        usage="Test Link",
        cable_type="Fiber",
        bandwidth="10G"
    )
    
    # 创建draw.io文档
    document = DrawioDocument._create_blank()
    
    # 添加设备
    src_device_id = document.id_gen.new("device")
    dst_device_id = document.id_gen.new("device")
    
    # 添加链路
    edge_id = document.add_link(link, src_device_id, dst_device_id)
    
    # 验证生成的XML包含表格格式的边标签
    with tempfile.NamedTemporaryFile(mode='w', suffix='.drawio', delete=False) as f:
        temp_path = Path(f.name)
        document.write(temp_path)
        
        # 读取生成的文件内容
        content = temp_path.read_text(encoding='utf-8')
        
        # 验证包含分离的edgeLabel元素
        assert content.count('edgeLabel') >= 2, "应该包含至少两个边标签"
        assert '&lt;br/&gt;' in content, "应该使用<br/>分行显示字段"
        
        # 验证包含完整的字段信息（简洁格式）
        assert "PC1" in content, "应该包含源端Port-Channel信息"
        assert "PC2" in content, "应该包含目标端Port-Channel信息"
        assert "Eth1/1" in content, "应该包含源端接口信息"
        assert "Eth1/2" in content, "应该包含目标端接口信息"
        assert "VRF:VRF-MAIN" in content, "应该包含VRF信息"
        assert "VLAN:100" in content, "应该包含源端VLAN信息"
        assert "VLAN:200" in content, "应该包含目标端VLAN信息"
        assert "192.168.1.1/30" in content, "应该包含源端IP信息"
        assert "192.168.1.2/30" in content, "应该包含目标端IP信息"

        # 验证源端和目标端标签的位置
        assert 'x="-0.8"' in content, "源端标签应该在边的左侧"
        assert 'x="0.8"' in content, "目标端标签应该在边的右侧"
        
        # 清理临时文件
        temp_path.unlink()
    
    print("✅ 边分离多行文本标签测试通过")
    print("分离多行文本标签效果：")
    print("- 源端和目标端信息分别显示在两个独立的文本框中")
    print("- 源端文本框靠近源节点，目标端文本框靠近目标节点")
    print("- 每个字段分行显示，清晰易读")
    print("- 每个文本框都可以独立双击编辑")
    print("- 包含完整的Port-Channel、接口、VRF、VLAN、IP信息")
    print("- 标签会随着边一起移动")


if __name__ == "__main__":
    test_edge_separated_multiline_labels()
